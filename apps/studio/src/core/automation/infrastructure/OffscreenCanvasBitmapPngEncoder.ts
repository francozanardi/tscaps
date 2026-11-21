import type { BitmapPngEncoder, EncodedPng, PictureCrop } from '@core/automation/domain/BitmapPngEncoder';

/** Draws the picture, or the part kept, on an offscreen canvas at the size asked and lets the browser write the PNG. */
export class OffscreenCanvasBitmapPngEncoder implements BitmapPngEncoder {
  async encode(bitmap: ImageBitmap, crop: PictureCrop | null, maxSidePx: number | null): Promise<EncodedPng> {
    const source = this.sourceArea(bitmap, crop);
    const scale = maxSidePx === null ? 1 : Math.min(1, maxSidePx / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('No 2D context for an offscreen canvas');
    context.drawImage(bitmap, source.x, source.y, source.width, source.height, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
  }

  /** The part to draw, in the picture's pixels, at least one pixel on each side. */
  private sourceArea(bitmap: ImageBitmap, crop: PictureCrop | null): { x: number; y: number; width: number; height: number } {
    if (crop === null) return { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
    const left = Math.min(Math.max(crop.x, 0), 1);
    const top = Math.min(Math.max(crop.y, 0), 1);
    const right = Math.min(Math.max(crop.x + crop.width, left), 1);
    const bottom = Math.min(Math.max(crop.y + crop.height, top), 1);
    return {
      x: Math.round(left * bitmap.width),
      y: Math.round(top * bitmap.height),
      width: Math.max(1, Math.round((right - left) * bitmap.width)),
      height: Math.max(1, Math.round((bottom - top) * bitmap.height)),
    };
  }
}
