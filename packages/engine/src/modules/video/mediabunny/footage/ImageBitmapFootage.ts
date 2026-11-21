import type { FootagePicture } from '@modules/video/FootagePicture';
import type { OpenedFootage } from '@modules/video/mediabunny/footage/OpenedFootage';

/**
 * {@link OpenedFootage} over a still image decoded once: every moment
 * answers the same picture. Closing it releases the bitmap.
 */
export class ImageBitmapFootage implements OpenedFootage, FootagePicture {
  private bitmap: ImageBitmap | null;
  readonly width: number;
  readonly height: number;

  constructor(bitmap: ImageBitmap) {
    this.bitmap = bitmap;
    this.width = bitmap.width;
    this.height = bitmap.height;
  }

  pictureAt(): Promise<FootagePicture | null> {
    return Promise.resolve(this.bitmap === null ? null : this);
  }

  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void {
    if (this.bitmap === null) throw new Error('ImageBitmapFootage.draw called after close.');
    context.drawImage(this.bitmap, dx, dy, dWidth, dHeight);
  }

  close(): Promise<void> {
    this.bitmap?.close();
    this.bitmap = null;
    return Promise.resolve();
  }
}
