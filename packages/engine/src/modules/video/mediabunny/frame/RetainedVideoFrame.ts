import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import { profiler } from '@modules/profiling/Profiler';

/**
 * A decoded frame's pixels copied onto a canvas of the caller's own, so
 * they outlive the decoder's frame.
 *
 * A decoder hands out frames it expects back promptly: holding several
 * at once back-pressures the frame pool into a stall. Copying breaks
 * that tie — the decoder's frame closes immediately and what stays
 * alive is an ordinary canvas, at the cost of one full-frame draw and
 * `width × height × 4` bytes per frame held.
 */
export class RetainedVideoFrame implements DecodedVideoFrame {

  /**
   * Copies `frame` at the given dimensions. Does not close `frame`;
   * the caller keeps that responsibility and may do so as soon as this
   * returns.
   */
  static copyOf(frame: DecodedVideoFrame, width: number, height: number): RetainedVideoFrame {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Unable to acquire a 2D context to retain a video frame.');
    }
    // Smoothing left at the context default, which matters whenever the
    // export was asked for dimensions the source does not have: this is
    // the only resample those pixels get before they reach the encoder.
    profiler.time('RetainedVideoFrame.copy', () => frame.draw(context, 0, 0, width, height));
    return new RetainedVideoFrame(canvas, frame.timestamp, frame.duration);
  }

  /**
   * A frame of `width × height` that `paint` draws once, on an opaque
   * canvas starting black, stamped with the given time. `paint` runs
   * before this returns; anything it draws from may be closed after.
   */
  static paintedBy(
    width: number,
    height: number,
    stamp: { readonly timestamp: number; readonly duration: number },
    paint: (context: OffscreenCanvasRenderingContext2D) => void,
  ): RetainedVideoFrame {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Unable to acquire a 2D context to retain a video frame.');
    }
    profiler.time('RetainedVideoFrame.paint', () => paint(context));
    return new RetainedVideoFrame(canvas, stamp.timestamp, stamp.duration);
  }

  private canvas: OffscreenCanvas | null;

  private constructor(
    canvas: OffscreenCanvas,
    readonly timestamp: number,
    readonly duration: number,
  ) {
    this.canvas = canvas;
  }

  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void {
    if (!this.canvas) {
      throw new Error('RetainedVideoFrame.draw called after close.');
    }
    context.drawImage(this.canvas, dx, dy, dWidth, dHeight);
  }

  close(): void {
    // Dropping the reference is what frees the pixels; an OffscreenCanvas
    // has no explicit release. Sizing it to nothing first hands the
    // buffer back without waiting for a collection.
    if (this.canvas) {
      this.canvas.width = 0;
      this.canvas.height = 0;
    }
    this.canvas = null;
  }
}
