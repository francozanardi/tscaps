import { CaptionBlendMode } from '@modules/rendering/types/CaptionBlendMode';
import { CaptionStacking } from '@modules/rendering/types/CaptionStacking';

/**
 * One raster the frame's captions are split into: where it is stacked
 * relative to the top layer, and how it is composited there.
 *
 * Every caption subtree paints in exactly one layer, and a renderer
 * paints exactly one. The frame is composited under the top layer first
 * and over it after, and on each side the plain layer first and the
 * blended ones over it, each
 * against everything already beneath it — the video, the overlay,
 * the captions painted before it and, over the top layer, the top
 * layer itself.
 *
 * Instances are interned: two layers with the same stacking and blend mode
 * are the same object, so they compare with `===` and key a `Map` or a
 * `Set` directly.
 */
export class CaptionLayer {
  private static readonly interned = new Map<string, CaptionLayer>();

  /** Where every caption paints unless told otherwise. */
  static readonly BASE = CaptionLayer.of(CaptionStacking.UNDER_TOP_LAYER, CaptionBlendMode.NORMAL);

  private constructor(
    readonly stacking: CaptionStacking,
    readonly blendMode: CaptionBlendMode,
  ) {}

  static of(stacking: CaptionStacking, blendMode: CaptionBlendMode): CaptionLayer {
    const key = `${stacking}|${blendMode}`;
    let layer = CaptionLayer.interned.get(key);
    if (!layer) {
      layer = new CaptionLayer(stacking, blendMode);
      CaptionLayer.interned.set(key, layer);
    }
    return layer;
  }

  /**
   * `layers` in the order the frame composites them: under the top
   * layer before over it, and within a side the plain layer before the
   * blended ones, which follow in a fixed order of their own.
   */
  static inPaintOrder(layers: Iterable<CaptionLayer>): CaptionLayer[] {
    const stackings = Object.values(CaptionStacking);
    const modes = Object.values(CaptionBlendMode);
    return [...layers].sort((a, b) =>
      (stackings.indexOf(a.stacking) - stackings.indexOf(b.stacking)) || (modes.indexOf(a.blendMode) - modes.indexOf(b.blendMode)));
  }

  /** The canvas `globalCompositeOperation` that composites this layer. */
  compositeOperation(): GlobalCompositeOperation {
    return this.blendMode === CaptionBlendMode.NORMAL ? 'source-over' : this.blendMode;
  }
}
