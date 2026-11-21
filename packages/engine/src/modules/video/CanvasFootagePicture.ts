import type { FootagePicture } from '@modules/video/FootagePicture';

/** {@link FootagePicture} over a canvas, drawn as it stands when asked. */
export class CanvasFootagePicture implements FootagePicture {
  constructor(private readonly canvas: OffscreenCanvas | HTMLCanvasElement) {}

  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void {
    context.drawImage(this.canvas, dx, dy, dWidth, dHeight);
  }
}
