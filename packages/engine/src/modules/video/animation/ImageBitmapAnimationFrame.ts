import type { AnimationFrame } from '@modules/video/animation/AnimationFrameDecoder';

/** {@link AnimationFrame} over an `ImageBitmap`. Closing it releases the bitmap. */
export class ImageBitmapAnimationFrame implements AnimationFrame {
  constructor(private readonly bitmap: ImageBitmap) {}

  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void {
    context.drawImage(this.bitmap, dx, dy, dWidth, dHeight);
  }

  close(): void {
    this.bitmap.close();
  }
}
