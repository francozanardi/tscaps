import type { PaintFrame } from '@modules/video/mediabunny/encoder/VideoTrackEncoder';

/**
 * The surface an output frame is painted on: an {@link OffscreenCanvas}
 * of the output's size and its 2D context, set up the one way every
 * painted output frame is set up, so a frame painted here looks the same
 * whatever takes it afterwards.
 *
 * The context is opaque unless the output keeps transparency — an
 * opaque output's paint covers every pixel, so a channel nobody reads is
 * not worth carrying — and it never smooths. Not smoothing is free
 * whenever the output keeps the source's dimensions, which is the common
 * path. It is not free when the output is smaller: the source frame is
 * then scaled down unsmoothed. Whether that shows enough to be worth the
 * smoothing is unmeasured, so it stays as it is rather than moving on an
 * argument alone.
 */
export class OutputFrameCanvas {

  readonly canvas: OffscreenCanvas;
  private readonly context: OffscreenCanvasRenderingContext2D;

  constructor(
    readonly width: number,
    readonly height: number,
    private readonly alpha: boolean,
  ) {
    this.canvas = new OffscreenCanvas(width, height);
    const context = this.canvas.getContext('2d', {
      alpha,
      desynchronized: false,
      willReadFrequently: false,
    });
    if (!context) {
      throw new Error('Unable to acquire a 2D context on the offscreen canvas');
    }
    context.imageSmoothingEnabled = false;
    this.context = context;
  }

  /** Runs `paint` on the canvas, cleared first when the output keeps transparency. */
  paint(paint: PaintFrame): void {
    if (this.alpha) this.context.clearRect(0, 0, this.width, this.height);
    paint(this.context);
  }
}
