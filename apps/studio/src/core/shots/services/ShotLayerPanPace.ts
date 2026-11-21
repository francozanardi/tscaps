import type { EditorState } from '@core/editor/domain/EditorState';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { ShotLayerBoxShape } from '@core/shots/domain/ShotLayerBoxShape';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import type { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';

// A pan this fast reads as a drift across a picture rather than a swipe: widths of the frame crossed each second.
const SLOW_FRAME_WIDTHS_PER_SEC = 0.06;

/** How far a pan goes across a layer's picture and how long it has to do it. */
export interface PanTravel {
  /** Widths of the output frame the picture moves by. */
  readonly frameWidths: number;
  readonly lengthSec: number;
}

/**
 * How fast a pan crosses the picture of a shot layer: a pan travels
 * between two shares of what the layer's box leaves out of its file, so
 * the same two shares are a drift on a picture of its box's shape and a
 * swipe on a wide picture filling a tall frame. Measured on the layer as
 * it is laid out and for as long as it shows now; a layout or a run
 * changed afterwards changes the pace with it.
 */
export class ShotLayerPanPace {
  constructor(
    private readonly media: MediaAssetStore,
    private readonly assets: ShotLayerAssetReader,
    private readonly boxShape: ShotLayerBoxShape,
  ) {}

  /**
   * The share of what the box leaves out a pan held at `scale` crosses to
   * drift slowly for the whole time the layer `layerId` shows: all of it
   * (1) where even that is slow. Null where the layer, its shape or its
   * length is not known.
   */
  slowShareOf(state: EditorState, layerId: string, scale: number): number | null {
    const spare = this.spareFrameWidthsOf(state, layerId, scale);
    const lengthSec = this.lengthSecOf(state, layerId);
    if (spare === null || lengthSec === null) return null;
    if (!(spare > 0)) return 1;
    return Math.min(1, (SLOW_FRAME_WIDTHS_PER_SEC * lengthSec) / spare);
  }

  /** What a pan held at `scale` from the share `fromX` to the share `toX` crosses on the layer `layerId`; null where it cannot be told. */
  travelOf(state: EditorState, layerId: string, scale: number, fromX: number, toX: number): PanTravel | null {
    const spare = this.spareFrameWidthsOf(state, layerId, scale);
    const lengthSec = this.lengthSecOf(state, layerId);
    if (spare === null || lengthSec === null) return null;
    return { frameWidths: Math.abs(toX - fromX) * Math.max(0, spare), lengthSec };
  }

  /** How many widths of the output frame the picture held at `scale` is wider than its box: what a pan has to travel over. */
  private spareFrameWidthsOf(state: EditorState, layerId: string, scale: number): number | null {
    const layer = state.shots.findLayer(layerId);
    const frame = state.frameLayout;
    if (layer === null || frame === null || !(frame.height > 0)) return null;
    const frameShape = frame.width / frame.height;
    const placement = state.shots.placementOf(layerId);
    const fileShape = this.assets.assetOf(layer, this.media.snapshot())?.aspectRatio ?? null;
    const boxShape = this.boxShape.aspectRatioOf(placement, frameShape, fileShape);
    if (fileShape === null || boxShape === null) return null;
    const wider = fileShape / boxShape;
    const pictureInBoxWidths = placement.fit === 'cover' ? Math.max(1, wider) : Math.min(1, wider);
    return this.boxFrameWidthsOf(placement, frameShape) * (pictureInBoxWidths * scale - 1);
  }

  /** The width of the box `placement` gives a file, in widths of a frame of `frameShape`. */
  private boxFrameWidthsOf(placement: ShotLayerPlacement, frameShape: number): number {
    switch (placement.kind) {
      case 'full':
        return 1;
      case 'inset':
        return placement.subject === 'video' ? 1 : placement.width;
      case 'split': {
        // On a frame one unit tall, as the box's shape is worked out: a frame wider than tall is cut across.
        const gap = 2 * placement.padding * Math.min(frameShape, 1);
        const width = (frameShape > 1 ? placement.assetRatio * frameShape : frameShape) - gap;
        return Math.max(0, width) / frameShape;
      }
    }
  }

  /** How long the layer shows: from where its first shot opens to where the shot after its last one does. */
  private lengthSecOf(state: EditorState, layerId: string): number | null {
    const run = state.shots.runOf(layerId);
    const first = run[0];
    const last = run[run.length - 1];
    if (first === undefined || last === undefined) return null;
    const shots = state.shots.list();
    const endSec = shots[shots.indexOf(last) + 1]?.startSec ?? state.video.duration;
    return endSec > first.startSec ? endSec - first.startSec : null;
  }
}
