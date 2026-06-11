import type { SubtitleFrame } from '@modules/rendering/SubtitleFrameRenderer';

/**
 * A `SubtitleFrame` that paints multiple sub-frames in order onto the
 * same target. Layers are painted in the order supplied to
 * {@link from}; later layers cover earlier ones at overlapping pixels.
 */
export class LayeredSubtitleFrame implements SubtitleFrame {
  /**
   * Returns the cheapest `SubtitleFrame` equivalent to painting every
   * non-null entry of `layers` in order: `null` when all entries are
   * `null`, the single non-null entry itself when only one is
   * present, a `LayeredSubtitleFrame` over the present entries
   * otherwise.
   */
  static from(
    ...layers: ReadonlyArray<SubtitleFrame | null>
  ): SubtitleFrame | null {
    const presentLayers: SubtitleFrame[] = [];
    for (const layer of layers) {
      if (layer) presentLayers.push(layer);
    }
    if (presentLayers.length === 0) return null;
    if (presentLayers.length === 1) return presentLayers[0]!;
    return new LayeredSubtitleFrame(presentLayers);
  }

  private constructor(private readonly layers: ReadonlyArray<SubtitleFrame>) {}

  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void {
    for (const layer of this.layers) {
      layer.draw(context, dx, dy, dWidth, dHeight);
    }
  }
}
