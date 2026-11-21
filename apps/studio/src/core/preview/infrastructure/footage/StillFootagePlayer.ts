import type { FootagePass, FootagePicture } from '@tscaps/engine/advanced';
import type { FootagePlayer, HeldFootagePicture } from '@core/preview/infrastructure/footage/FootagePlayer';
import type { PreviewResolutionCap } from '@core/preview/services/PreviewResolutionCap';

/**
 * {@link FootagePlayer} for a still image: decoded once when opened,
 * scaled down to the preview's cap, and the same picture for the whole
 * pass whatever the playback does. Disposing it releases the bitmap.
 */
export class StillFootagePlayer implements FootagePlayer, FootagePicture {
  private bitmap: ImageBitmap | null = null;
  private streaming = false;
  private disposed = false;

  constructor(
    readonly pass: FootagePass,
    private readonly blob: Blob,
    private readonly resolutionCap: PreviewResolutionCap,
    private readonly onPainted: (pass: FootagePass) => void,
  ) {}

  open(): void {
    void this.decode();
  }

  isStreaming(): boolean {
    return this.streaming;
  }

  stream(): void {
    this.streaming = true;
  }

  still(): void {
    this.streaming = false;
  }

  scrub(): void {
    this.streaming = false;
  }

  idle(): void {
    this.streaming = false;
  }

  dispose(): void {
    this.disposed = true;
    this.bitmap?.close();
    this.bitmap = null;
  }

  picture(): HeldFootagePicture | null {
    return this.bitmap ? { picture: this, width: this.bitmap.width, height: this.bitmap.height } : null;
  }

  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void {
    if (this.bitmap) context.drawImage(this.bitmap, dx, dy, dWidth, dHeight);
  }

  private async decode(): Promise<void> {
    try {
      const bitmap = await this.capped(await createImageBitmap(this.blob));
      if (this.disposed) {
        bitmap.close();
        return;
      }
      this.bitmap = bitmap;
      this.onPainted(this.pass);
    } catch (error) {
      if (!this.disposed) console.error('[preview] a footage image could not be opened', error);
    }
  }

  /** The image within the preview's cap; a larger one is scaled down once and the original released. */
  private async capped(bitmap: ImageBitmap): Promise<ImageBitmap> {
    const target = this.resolutionCap.clamp(bitmap.width, bitmap.height);
    if (target.widthPx === bitmap.width && target.heightPx === bitmap.height) return bitmap;
    try {
      return await createImageBitmap(bitmap, { resizeWidth: target.widthPx, resizeHeight: target.heightPx, resizeQuality: 'high' });
    } finally {
      bitmap.close();
    }
  }
}
