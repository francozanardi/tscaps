import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';

/**
 * Stands in for a decoded frame with a solid colour: same timestamp and
 * duration, but drawing it fills the destination rectangle instead of
 * painting the frame's pixels.
 *
 * Does not own the frame it stands in for: closing it closes nothing.
 */
export class SolidColorVideoFrame implements DecodedVideoFrame {

  /** @param color Any CSS colour. */
  constructor(
    private readonly frame: DecodedVideoFrame,
    private readonly color: string,
  ) {}

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
    const previous = context.fillStyle;
    context.fillStyle = this.color;
    context.fillRect(dx, dy, dWidth, dHeight);
    context.fillStyle = previous;
  }

  /** The frame belongs to whoever decoded it. */
  close(): void {}
}
