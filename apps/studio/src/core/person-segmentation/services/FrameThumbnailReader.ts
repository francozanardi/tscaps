/**
 * Shrinks a frame to a small square thumbnail and reads its pixels back,
 * for comparing frames by their overall look. The canvas is reused
 * across frames; the pixels returned are a copy the caller keeps.
 */
export class FrameThumbnailReader {
  private static readonly SIZE_PX = 32;

  private context: OffscreenCanvasRenderingContext2D | null = null;

  /** The RGBA bytes of `bitmap` drawn at the thumbnail's size. Leaves the bitmap open. */
  pixelsOf(bitmap: ImageBitmap): Uint8ClampedArray {
    const size = FrameThumbnailReader.SIZE_PX;
    const context = this.surface();
    context.drawImage(bitmap, 0, 0, size, size);
    return context.getImageData(0, 0, size, size).data;
  }

  private surface(): OffscreenCanvasRenderingContext2D {
    if (this.context !== null) return this.context;
    const size = FrameThumbnailReader.SIZE_PX;
    const context = new OffscreenCanvas(size, size).getContext('2d', { willReadFrequently: true });
    if (context === null) throw new Error('OffscreenCanvas 2D context is unavailable');
    this.context = context;
    return context;
  }
}
