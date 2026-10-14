import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';

/**
 * Stands in for a decoded frame with nothing: same timestamp and
 * duration, but drawing it clears the destination rectangle to fully
 * transparent, whatever was painted there before.
 *
 * Does not own the frame it stands in for: closing it closes nothing.
 */
export class ClearedVideoFrame implements DecodedVideoFrame {

  constructor(private readonly frame: DecodedVideoFrame) {}

  get timestamp(): number {
    return this.frame.timestamp;
  }

  get duration(): number {
    return this.frame.duration;
  }

  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void {
    context.clearRect(dx, dy, dWidth, dHeight);
  }

  /** The frame belongs to whoever decoded it. */
  close(): void {}
}
