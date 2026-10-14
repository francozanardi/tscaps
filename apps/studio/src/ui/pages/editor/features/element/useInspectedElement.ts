import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { Document, Segment } from '@tscaps/engine';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { OverlaySelection, OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';

/** The element the inspector is editing, named the way the user sees it. */
export interface InspectedElement {
  readonly id: string;
  readonly kind: ElementKind;
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
 * Resolves what the user picked in the preview against the document
 * they are looking at.
 *
 * Returns `null` when nothing is picked and when the pick no longer
 * exists — undoing the edit that created a word, or loading another
 * project, leaves the selection holding an id the document has never
 * heard of, and editing that would write CSS nothing can render.
 *
 * Also `null` while the playhead is off the element. The pick itself
 * outlives that and comes back on scrubbing to it, but a surface
 * showing an element the preview has stopped marking as selected reads
 * as a second, disagreeing answer to what is selected.
 *
 * The resolution is also what tells a word from an emoji: the preview
 * reports both as the same kind of hit, and only the document knows
 * which one the id belongs to.
 */
export function useInspectedElement(
  controller: OverlaySelectionController,
  document: Document | null,
): InspectedElement | null {
  const subscribe = useCallback((notify: () => void) => controller.subscribe(notify), [controller]);
  const selection = useSyncExternalStore(subscribe, () => controller.paintedSelectionSnapshot());
  return useMemo(() => resolveInspectedElement(selection, document), [selection, document]);
}

function resolveInspectedElement(selection: OverlaySelection, document: Document | null): InspectedElement | null {
  if (!selection || !document) return null;
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
): InspectedElement | null {
  for (const line of segment.lines) {
    for (const word of line.words) {
      if (word.id === elementId) {
        return {
          id: elementId,
          kind: 'word',
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
