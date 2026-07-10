import type { GrayscaleFrame } from '@core/person-segmentation/domain/GrayscaleFrame';

type SourceImage = HTMLVideoElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas;

/**
 * Reduces an image source to a fixed-size single-channel grayscale
 * frame. The output resolution is the size supplied at construction —
 * the source is drawn into an internal canvas at that size, then the
 * RGBA pixels are collapsed to luma bytes.
 */
export class GrayscaleDownscaler {
  private readonly canvas: OffscreenCanvas;
  private readonly context: OffscreenCanvasRenderingContext2D;

  constructor(width: number, height: number) {
    this.canvas = new OffscreenCanvas(width, height);
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) throw new Error('OffscreenCanvas 2D context is unavailable');
    this.context = context;
  }

  fullFrame(source: SourceImage): GrayscaleFrame {
    return this.region(source, 0, 0, this.sourceWidth(source), this.sourceHeight(source));
  }

  region(source: SourceImage, sx: number, sy: number, sw: number, sh: number): GrayscaleFrame {
    this.context.drawImage(source, sx, sy, sw, sh, 0, 0, this.canvas.width, this.canvas.height);
    const image = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    return this.toGrayscale(image);
  }

  private toGrayscale(image: ImageData): GrayscaleFrame {
    const { data, width, height } = image;
    const gray = new Uint8Array(width * height);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = (data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114) | 0;
    }
    return { data: gray, width, height };
  }

  private sourceWidth(source: SourceImage): number {
    if (source instanceof HTMLVideoElement) return source.videoWidth;
    return source.width;
  }

  private sourceHeight(source: SourceImage): number {
    if (source instanceof HTMLVideoElement) return source.videoHeight;
    return source.height;
  }
}
