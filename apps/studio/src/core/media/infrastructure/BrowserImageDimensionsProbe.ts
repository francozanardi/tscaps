import type { ImageDimensions, ImageDimensionsProbe } from '@core/media/domain/ImageDimensionsProbe';

/**
 * `ImageDimensionsProbe` over the browser's own decoder. `createImageBitmap`
 * reads every type the editor takes, a GIF's first frame included, and
 * the bitmap is closed at once so nothing decoded is kept.
 */
export class BrowserImageDimensionsProbe implements ImageDimensionsProbe {
  async probe(image: Blob): Promise<ImageDimensions> {
    const bitmap = await createImageBitmap(image);
    try {
      if (bitmap.width <= 0 || bitmap.height <= 0) throw new Error('The picture has no size');
      return { widthPx: bitmap.width, heightPx: bitmap.height };
    } finally {
      bitmap.close();
    }
  }
}
