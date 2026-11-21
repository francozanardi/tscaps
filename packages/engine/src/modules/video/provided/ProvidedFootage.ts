import type { DrawableFootage } from '@modules/video/animation/DrawableFootage';
import type { FootagePicture } from '@modules/video/FootagePicture';
import type { ProvidedFootagePictures } from '@modules/video/provided/ProvidedFootagePictures';

/**
 * Footage whose pictures a {@link ProvidedFootagePictures} hands over,
 * holding the last one: drawing it draws that picture, which stays
 * until a later answer replaces it, so a holder can draw it again while
 * the next moment is being drawn. A moment the picture held already
 * stands for is answered with it, and nothing is drawn again.
 *
 * Answers land in the order they were asked; one landing after a later
 * question was answered is dropped. Closing it releases the picture held
 * and closes the pictures it reads.
 */
export class ProvidedFootage implements DrawableFootage {
  private bitmap: ImageBitmap | null = null;
  private heldFrame: number | null = null;
  private asked = 0;
  private landed = 0;
  private closed = false;

  constructor(private readonly pictures: ProvidedFootagePictures) {}

  get width(): number {
    return this.pictures.width;
  }

  get height(): number {
    return this.pictures.height;
  }

  async pictureAt(sourceSec: number): Promise<FootagePicture | null> {
    if (this.closed) return null;
    const question = ++this.asked;
    const frame = this.pictures.frameOf(sourceSec);
    if (this.bitmap !== null && frame === this.heldFrame) {
      // The latest question is answered: a picture asked earlier and still on its way is no longer wanted.
      this.landed = question;
      return this;
    }
    const bitmap = await this.pictures.pictureAt(sourceSec);
    if (this.closed || question < this.landed) {
      bitmap.close();
      return this.closed ? null : this;
    }
    this.landed = question;
    this.bitmap?.close();
    this.bitmap = bitmap;
    this.heldFrame = frame;
    return this;
  }

  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void {
    if (this.bitmap !== null) context.drawImage(this.bitmap, dx, dy, dWidth, dHeight);
  }

  close(): Promise<void> {
    if (this.closed) return Promise.resolve();
    this.closed = true;
    this.bitmap?.close();
    this.bitmap = null;
    this.heldFrame = null;
    this.pictures.close();
    return Promise.resolve();
  }
}
