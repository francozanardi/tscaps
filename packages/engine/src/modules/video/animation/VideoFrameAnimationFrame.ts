import type { AnimationFrame } from '@modules/video/animation/AnimationFrameDecoder';

/** {@link AnimationFrame} over a WebCodecs `VideoFrame`. Closing it releases the frame. */
export class VideoFrameAnimationFrame implements AnimationFrame {
  constructor(private readonly frame: VideoFrame) {}

  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void {
    context.drawImage(this.frame, dx, dy, dWidth, dHeight);
  }

  close(): void {
    this.frame.close();
  }
}
