import type { EditorState } from '@core/editor/domain/EditorState';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import type { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import { SHOT_LAYER_LAYOUT_FIELD_IDS } from '@core/shots/domain/ShotLayerLayoutFields';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import type { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import type { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import type { ElementStyleReadout, ElementStyleReadoutRow } from '@core/editor-operations/services/ElementStyleReadout';
import type { GraphicReadout, GraphicReadoutDetail } from '@core/editor-operations/services/GraphicReadout';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';
import type { ProjectLayer } from '@core/editor-operations/services/ShotRefResolver';

/** What a layer shows: a video (a b-roll), a still picture, a GIF, a graphic, or a file the media bin no longer holds. */
export type ShotLayerType = 'video' | 'picture' | 'gif' | 'graphic' | 'missing';

/** A layer in a list: its ref, what it shows and what it is called (its file's name, or its graphic's). */
export interface ShotLayerRow {
  readonly ref: string;
  readonly type: ShotLayerType;
  readonly name: string;
  /** The last shot it shows on, as a ref, where that is a shot after the one holding it; absent for a layer that ends with its own shot. */
  readonly through?: string;
}

/** How a split or a picture-in-picture layout plays at one end of a layer, and for how long; a cut takes no time. */
export interface ShotLayerEdgeReadout {
  readonly kind: string;
  readonly durationSec?: number;
}

/** How a split or a picture-in-picture layout plays as the layer comes in and as it leaves. */
interface ShotLayerEdgesReadout {
  readonly entrance: ShotLayerEdgeReadout;
  readonly exit: ShotLayerEdgeReadout;
}

/** A layer's layout, with, for a split or a picture in picture, how it plays at the layer's ends. */
export type ShotLayerPlacementReadout = ShotLayerPlacement & Partial<ShotLayerEdgesReadout>;

/** Everything about one layer, as a read answers it. */
export interface ShotLayerDetail extends ShotLayerRow {
  readonly kind: 'layer';
  readonly shot: string;
  readonly file?: {
    readonly mediaId: string;
    readonly name?: string;
    readonly durationSec?: number;
    readonly width?: number;
    readonly height?: number;
  };
  /** A video layer's stretch of its file, in seconds of the file; null `outSec` plays to the file's end. */
  readonly timing?: { readonly inSec: number; readonly outSec: number | null; readonly loop: boolean };
  readonly graphic?: GraphicReadoutDetail;
  readonly placement: ShotLayerPlacementReadout;
  readonly style?: ElementStyleReadoutRow;
  /** How loud the layer's own file is heard, 0 to 2; absent while it plays silent. */
  readonly soundVolume?: number;
}

/**
 * Reads the layers of shots for a read answer: one line per layer in a
 * list, and everything about one layer on its own. A layer's layout is
 * answered as a typed placement rather than as the fields that record
 * it, holding the transitions a split or a picture-in-picture plays at
 * the layer's ends, by kind, as `entrance` and `exit`.
 */
export class ShotLayerReadout {
  private readonly fieldsSaidElsewhere: ReadonlySet<string>;

  constructor(
    private readonly media: MediaAssetStore,
    private readonly assets: ShotLayerAssetReader,
    private readonly graphics: GraphicReadout,
    private readonly styles: ElementStyleReadout,
    private readonly splitTransitions: ShotLayerSplitTransitions,
    private readonly insetTransitions: ShotLayerInsetTransitions,
    private readonly parser: EditorRefParser,
    private readonly format: ReadoutFormatter,
  ) {
    this.fieldsSaidElsewhere = new Set<string>([
      ...SHOT_LAYER_LAYOUT_FIELD_IDS,
      ...(['entrance', 'exit'] as const).flatMap((edge) => [
        this.splitTransitions.kindFieldOf(edge),
        this.splitTransitions.durationFieldOf(edge),
        this.insetTransitions.kindFieldOf(edge),
        this.insetTransitions.durationFieldOf(edge),
      ]),
    ]);
  }

  row(layer: ShotLayer): ShotLayerRow {
    return {
      ref: this.parser.formatOf('layer', layer.id),
      type: this.typeOf(layer),
      name: this.nameOf(layer),
      ...(layer.throughShotId === undefined ? {} : { through: this.parser.formatOf('shot', layer.throughShotId) }),
    };
  }

  /** The ref of `layer`, as a shot it continues into names it. */
  refOf(layer: ShotLayer): string {
    return this.parser.formatOf('layer', layer.id);
  }

  /** The ref of the shot `shotId`. */
  shotRefOf(shotId: string): string {
    return this.parser.formatOf('shot', shotId);
  }

  /** Everything about `projectLayer` in the project `state`: what it shows, where it sits, how it looks and moves, and how loud it is. */
  detail(projectLayer: ProjectLayer, state: EditorState): ShotLayerDetail {
    const { layer } = projectLayer;
    const type = this.typeOf(layer);
    const style = this.styles.of(state.shots.layerStyles.get(layer.id), this.fieldsSaidElsewhere);
    const soundVolume = state.audio.footageVolumeOf(layer.id);
    return {
      ...this.row(layer),
      kind: 'layer',
      shot: projectLayer.shot.ref,
      ...('graphic' in layer
        ? { graphic: this.graphics.detail(layer.id, layer.graphic) }
        : { file: this.fileOf(layer.mediaId) }),
      ...('mediaId' in layer && type === 'video'
        ? { timing: { inSec: this.format.sec(layer.inSec), outSec: layer.outSec === null ? null : this.format.sec(layer.outSec), loop: layer.loop } }
        : {}),
      placement: { ...this.placementOf(state.shots.placementOf(layer.id)), ...this.edgesOf(layer.id, state) },
      ...(style === null ? {} : { style }),
      ...(soundVolume > 0 ? { soundVolume: this.format.share(soundVolume) } : {}),
    };
  }

  private typeOf(layer: ShotLayer): ShotLayerType {
    const asset = this.assets.assetOf(layer, this.media.snapshot());
    if (asset === null) return 'missing';
    return asset.kind === 'image' ? 'picture' : asset.kind;
  }

  private nameOf(layer: ShotLayer): string {
    if ('graphic' in layer) return this.graphics.nameOf(layer.graphic);
    return this.media.snapshot().get(layer.mediaId)?.fileName ?? layer.mediaId;
  }

  private fileOf(mediaId: string): NonNullable<ShotLayerDetail['file']> {
    const asset = this.media.snapshot().get(mediaId);
    if (asset === null) return { mediaId };
    return {
      mediaId,
      name: asset.fileName,
      ...(asset.durationSec === null ? {} : { durationSec: this.format.sec(asset.durationSec) }),
      ...(asset.widthPx === null ? {} : { width: asset.widthPx }),
      ...(asset.heightPx === null ? {} : { height: asset.heightPx }),
    };
  }

  private edgesOf(layerId: string, state: EditorState): ShotLayerEdgesReadout | Record<string, never> {
    const fields = state.shots.layerStyles.get(layerId)?.fields;
    switch (state.shots.placementOf(layerId).kind) {
      case 'split':
        return {
          entrance: this.edge(this.splitTransitions.kindOf(fields, 'entrance'), this.splitTransitions.durationSecOf(fields, 'entrance')),
          exit: this.edge(this.splitTransitions.kindOf(fields, 'exit'), this.splitTransitions.durationSecOf(fields, 'exit')),
        };
      case 'inset':
        return {
          entrance: this.edge(this.insetTransitions.kindOf(fields, 'entrance'), this.insetTransitions.durationSecOf(fields, 'entrance')),
          exit: this.edge(this.insetTransitions.kindOf(fields, 'exit'), this.insetTransitions.durationSecOf(fields, 'exit')),
        };
      case 'full':
        return {};
    }
  }

  private edge(kind: string, durationSec: number): ShotLayerEdgeReadout {
    return kind === 'cut' ? { kind } : { kind, durationSec: this.format.sec(durationSec) };
  }

  private placementOf(placement: ShotLayerPlacement): ShotLayerPlacement {
    const position = placement.position === undefined
      ? {}
      : { position: { x: this.format.share(placement.position.x), y: this.format.share(placement.position.y) } };
    switch (placement.kind) {
      case 'full':
        return { ...placement, ...position };
      case 'split':
        return {
          ...placement,
          assetRatio: this.format.share(placement.assetRatio),
          padding: this.format.share(placement.padding),
          cornerRadius: this.format.share(placement.cornerRadius),
          ...position,
        };
      case 'inset':
        return {
          ...placement,
          centerX: this.format.share(placement.centerX),
          centerY: this.format.share(placement.centerY),
          width: this.format.share(placement.width),
          aspectRatio: placement.aspectRatio === null ? null : this.format.share(placement.aspectRatio),
          padding: this.format.share(placement.padding),
          cornerRadius: this.format.share(placement.cornerRadius),
          ...position,
        };
    }
  }
}
