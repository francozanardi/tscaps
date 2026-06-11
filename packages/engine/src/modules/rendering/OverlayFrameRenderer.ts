/**
 * A drawable handle for a frame-invariant decoration: the same raster
 * is composed into every output frame of a render. Where it sits
 * relative to other layers is decided by the compositor, not by the
 * overlay itself.
 */
export interface OverlayFrame {
  /**
   * Paints the overlay into `context` at `(dx, dy)` scaled to
   * `dWidth × dHeight`. The source rectangle is the full overlay.
   */
  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void;
}

/**
 * Rasterizes an HTML snippet into one drawable {@link OverlayFrame}
 * sized to the requested output dimensions. The result is
 * paint-once / draw-many: the same `OverlayFrame` is reused for every
 * frame of a render.
 *
 * The HTML must be self-contained — styling has to live inline,
 * because the render context is sandboxed from the host document's
 * stylesheets.
 */
export interface OverlayFrameRenderer {
  render(html: string, width: number, height: number): Promise<OverlayFrame>;
}
