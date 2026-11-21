import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { Document, Segment } from '@tscaps/engine';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type {
  CaptionSelection,
  OverlaySelectionController,
  ShotLayerGroupSelection,
  ShotLayerSelection,
} from '@presentation/editor/controllers/OverlaySelectionController';
import { ELEMENT_KIND_LABELS } from '@ui/_shared/components/element-fields/ElementKindLabels';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { ShotLayerLabels } from '@presentation/shots/services/ShotLayerLabels';
import type { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';

/** The element the inspector is editing: a caption element, a shot layer, several shot layers at once, or a shot. */
export type InspectedElement = InspectedCaptionElement | InspectedShotLayer | InspectedShotLayerGroup | InspectedShot;

/** A caption element the inspector is editing, named the way the user sees it. */
export interface InspectedCaptionElement {
  readonly id: string;
  readonly kind: ElementKind;
  /** What the element is called on screen. */
  readonly kindLabel: string;
  /**
   * The element in the user's terms, which is what it says wherever it
   * says anything: the word, the scene's own words, the glyph. Quoted
   * where it is text the user wrote, so a one-word caption cannot be
   * read as a label of ours, and taken from what is painted rather than
   * from the source, so an effect that lowercased it is not argued with
   * in the panel's own title.
   */
  readonly name: string;
  /** Where it sits, when that is not the element itself. */
  readonly context: string | null;
  /**
   * The elements it sits inside, nearest first.
   *
   * What a field falls back to when the element has been told nothing:
   * the nearest ancestor that was told something answers, and the sheet
   * answers when none of them was.
   */
  readonly ancestorIds: ReadonlyArray<string>;
  /** The sheet whose rules the element renders under, which is what its fields fall back to. */
  readonly sheetId: string;
  /** The stretch of video it occupies, which is what playing it back means. */
  readonly startsAt: number;
  readonly endsAt: number;
  /**
   * When the scene holding it stops being painted, and with it the
   * pick itself. A word may be played past its own end, up to here.
   */
  readonly sceneEndsAt: number;
  /** The scene holding it, or the scene itself. */
  readonly scene: Segment;
}

/**
 * A shot layer the inspector is editing. It is not a caption element:
 * it carries no style, only what its shot says about it — its file,
 * where it sits and which stretch of the file it plays.
 */
export interface InspectedShotLayer {
  readonly kind: 'shot-layer';
  /** The layer's id. */
  readonly id: string;
  /** What the element is called on screen. */
  readonly kindLabel: string;
  /** The file's name, which is the only name a file layer has, a deleted file saying so; a graphic is named for what it is. */
  readonly name: string;
  /** The shot holding it, by its number in the list, and for a file that plays, how long the file runs. */
  readonly context: string;
  readonly layer: ShotLayer;
  readonly shotId: string;
  /** Its file, or null when the file was deleted or it is a graphic, which has none. */
  readonly media: MediaAsset | null;
}

/** One of several shot layers edited together. */
export interface InspectedGroupedShotLayer {
  readonly layer: ShotLayer;
  /** Its file, or null when the file was deleted. */
  readonly media: MediaAsset | null;
  /** What it shows, or null for a file the open project does not hold. */
  readonly kind: 'video' | 'image' | 'gif' | 'graphic' | null;
}

/**
 * Several shot layers the inspector is editing together, in the order
 * the shots panel shows them: the first is the one whose values the
 * fields show.
 */
export interface InspectedShotLayerGroup {
  readonly kind: 'shot-layers';
  readonly kindLabel: string;
  /** How many of which kind: "3 b-rolls". */
  readonly name: string;
  /** The shots holding them: "Shots 1, 3, 4". */
  readonly context: string;
  readonly layers: ReadonlyArray<InspectedGroupedShotLayer>;
}

/**
 * A shot the inspector is editing as a whole: what its camera does with
 * its own video. Named by its number in the list.
 */
export interface InspectedShot {
  readonly kind: 'shot';
  readonly shotId: string;
  readonly kindLabel: string;
  /** "Shot 3". */
  readonly name: string;
  /** Where it starts, in source time, as the shots panel shows it. */
  readonly context: string;
  /** Where it starts and ends, in source time; the end is null for the last shot of a video of unknown length. */
  readonly startSec: number;
  readonly endSec: number | null;
  /** Where its own video stops being drawn, in source time: its end, or that of the last shot its video runs through; null as `endSec` is. */
  readonly videoEndSec: number | null;
}

const SHOT_LAYER_LABELS = new ShotLayerLabels();

/**
 * Resolves what the user picked in the preview against the document
 * and the shots they are looking at.
 *
 * Returns `null` when nothing is picked and when the pick no longer
 * exists — undoing the edit that created a word or a layer, or loading another
 * project, leaves the selection holding an id the document has never
 * heard of, and editing that would write CSS nothing can render.
 *
 * It answers wherever the playhead is: the pick outlives what is on
 * screen, and the inspector says when it is off it.
 *
 * The resolution is also what tells a word from an emoji: the preview
 * reports both as the same kind of hit, and only the document knows
 * which one the id belongs to.
 */
export function useInspectedElement(
  controller: OverlaySelectionController,
  document: Document | null,
  shots: ShotPartition,
): InspectedElement | null {
  const subscribe = useCallback((notify: () => void) => controller.subscribe(notify), [controller]);
  const selection = useSyncExternalStore(subscribe, () => controller.selectionSnapshot());
  const media = useMediaAssets();
  const { services } = useShots();
  const state = useEditorState();
  return useMemo(() => {
    if (!selection) return null;
    switch (selection.kind) {
      case 'shot-layer': return resolveShotLayer(selection, shots, media, services.layerAssets);
      case 'shot-layers': return resolveShotLayerGroup(selection, shots, media, services.layerAssets);
      case 'caption': return resolveCaptionElement(selection, document);
      // A shot still only proposed is inspected as the shots panel lists it.
      case 'shot': return resolveShot(selection.shotId, services.materializer.materializeFrom(state));
    }
  }, [selection, document, shots, media, services, state]);
}

function resolveShotLayer(
  selection: ShotLayerSelection,
  shots: ShotPartition,
  catalog: MediaAssetCatalog,
  layerAssets: ShotLayerAssetReader,
): InspectedShotLayer | null {
  const layer = shots.findLayer(selection.layerId);
  const shot = shots.shotHolding(selection.layerId);
  if (!layer || !shot) return null;
  const file = layerAssets.fileOf(layer);
  const media = file === null ? null : catalog.get(file.mediaId);
  const kindLabel = SHOT_LAYER_LABELS.labelOf(layerAssets.assetOf(layer, catalog)?.kind ?? null);
  return {
    kind: 'shot-layer',
    id: layer.id,
    kindLabel,
    name: file === null ? kindLabel : media ? media.fileName : 'Deleted file',
    context: shotLayerContext(shots, layer.id, media),
    layer,
    shotId: shot.id,
    media,
  };
}

/** The layers of the group still held by a shot, in the group's order; null where none is. */
function resolveShotLayerGroup(
  selection: ShotLayerGroupSelection,
  shots: ShotPartition,
  catalog: MediaAssetCatalog,
  layerAssets: ShotLayerAssetReader,
): InspectedShotLayerGroup | null {
  const shotList = shots.list();
  const held = selection.layerIds.flatMap((layerId) => {
    const layer = shots.findLayer(layerId);
    const shot = shots.shotHolding(layerId);
    if (!layer || !shot) return [];
    const kind = layerAssets.assetOf(layer, catalog)?.kind ?? null;
    const file = layerAssets.fileOf(layer);
    return [{ layer, media: file === null ? null : catalog.get(file.mediaId), kind, shotNumber: shotList.indexOf(shot) + 1 }];
  });
  if (held.length === 0) return null;
  return {
    kind: 'shot-layers',
    kindLabel: 'Selected',
    name: SHOT_LAYER_LABELS.countOf(held.flatMap(({ kind }) => (kind === null ? [] : [kind]))),
    context: SHOT_LAYER_LABELS.shotsOf(held.map(({ shotNumber }) => shotNumber)),
    layers: held.map(({ layer, media, kind }) => ({ layer, media, kind })),
  };
}

function resolveShot(shotId: string, shots: ShotPartition): InspectedShot | null {
  const list = shots.list();
  const index = list.findIndex((shot) => shot.id === shotId);
  const shot = list[index];
  if (shot === undefined) return null;
  const endSec = list[index + 1]?.startSec ?? null;
  return {
    kind: 'shot',
    shotId,
    kindLabel: 'Shot',
    name: `Shot ${index + 1}`,
    context: endSec === null ? `From ${shot.startSec.toFixed(1)} s` : `${shot.startSec.toFixed(1)} s – ${endSec.toFixed(1)} s`,
    startSec: shot.startSec,
    endSec,
    videoEndSec: list[index + Math.max(1, shots.videoRunOf(shotId).length)]?.startSec ?? null,
  };
}

/** The shots the layer shows on and, for a video, how long its file runs. */
function shotLayerContext(shots: ShotPartition, layerId: string, media: MediaAsset | null): string {
  const list = shots.list();
  const run = shots.runOf(layerId);
  const shown = shots.showsOverWholeVideo(layerId)
    ? 'Whole video'
    : SHOT_LAYER_LABELS.runOf(list.indexOf(run[0]!) + 1, list.indexOf(run[run.length - 1]!) + 1);
  if (media === null || media.durationSec === null) return shown;
  return `${shown} · ${media.durationSec.toFixed(1)} s`;
}

function resolveCaptionElement(selection: CaptionSelection, document: Document | null): InspectedCaptionElement | null {
  if (!document) return null;
  // A section's kind is the id of the sheet that owns it, so walking
  // sections is what turns the pick into the rules it renders under.
  let position = 0;
  for (const section of document.sections) {
    for (const segment of section.segments) {
      position += 1;
      if (segment.id !== selection.segmentId) continue;
      const scene = `Scene ${position}`;
      if (selection.wordId === null) {
        const spoken = spokenText(segment);
        return {
          id: segment.id,
          kind: 'segment',
          kindLabel: ELEMENT_KIND_LABELS.segment,
          name: spoken === '' ? scene : `“${spoken}”`,
          context: spoken === '' ? null : scene,
          ancestorIds: [],
          sheetId: section.kind,
          startsAt: segment.time.start,
          endsAt: segment.time.end,
          sceneEndsAt: segment.time.end,
          scene: segment,
        };
      }
      return resolveWithinSegment(segment, selection.wordId, scene, section.kind);
    }
  }
  return null;
}

/**
 * What the scene says, as it is painted. Empty for a scene with no
 * words, which is what an inserted one starts as — that one has only
 * its number to go by.
 */
function spokenText(segment: Segment): string {
  return segment.lines
    .map((line) => line.words.map((word) => word.displayText).join(' '))
    .join(' ')
    .trim();
}

function resolveWithinSegment(
  segment: Segment,
  elementId: string,
  scene: string,
  sheetId: string,
): InspectedCaptionElement | null {
  for (const line of segment.lines) {
    for (const word of line.words) {
      if (word.id === elementId) {
        return {
          id: elementId,
          kind: 'word',
          kindLabel: ELEMENT_KIND_LABELS.word,
          name: `“${word.displayText}”`,
          context: scene,
          ancestorIds: [segment.id],
          sheetId,
          startsAt: word.time.start,
          endsAt: word.time.end,
          sceneEndsAt: segment.time.end,
          scene: segment,
        };
      }
      if (word.decoration?.id === elementId) {
        // A glyph runs on its own window when it was given one, and on
        // its word's otherwise, which is the same rule its clock keeps.
        const time = word.decoration.customTime ?? word.time;
        return {
          id: elementId,
          kind: 'decoration',
          kindLabel: ELEMENT_KIND_LABELS.decoration,
          name: word.decoration.glyph,
          context: scene,
          ancestorIds: [word.id, segment.id],
          sheetId,
          startsAt: time.start,
          endsAt: time.end,
          sceneEndsAt: segment.time.end,
          scene: segment,
        };
      }
    }
  }
  return null;
}
