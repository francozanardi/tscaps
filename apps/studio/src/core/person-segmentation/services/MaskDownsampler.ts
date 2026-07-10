import type { PersonSegmentationMask } from '@core/person-segmentation/domain/PersonSegmentationMask';

/**
 * Compresses a MediaPipe confidence mask to a bounded resolution. The
 * mask arrives from the segmenter at input-video resolution but the
 * useful signal lives at the model's native ~256px; downsampling to
 * a bounded max side lets the cache store per-frame masks without
 * blowing memory. Consumers upscale at composite time via drawImage.
 */
export class MaskDownsampler {
  private readonly sourceCanvas: OffscreenCanvas;
  private readonly sourceContext: OffscreenCanvasRenderingContext2D;
  private readonly targetCanvas: OffscreenCanvas;
  private readonly targetContext: OffscreenCanvasRenderingContext2D;

  constructor(private readonly targetMaxSide: number) {
    this.sourceCanvas = new OffscreenCanvas(1, 1);
    this.sourceContext = this.requireContext(this.sourceCanvas);
    this.targetCanvas = new OffscreenCanvas(1, 1);
    this.targetContext = this.requireContext(this.targetCanvas);
  }

  downsample(confidence: Float32Array, sourceWidth: number, sourceHeight: number, timestamp: number): PersonSegmentationMask {
    const scale = Math.min(1, this.targetMaxSide / Math.max(sourceWidth, sourceHeight));
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    this.paintSourceCanvas(confidence, sourceWidth, sourceHeight);
    return this.readTargetCanvas(timestamp, targetWidth, targetHeight);
  }

  private paintSourceCanvas(confidence: Float32Array, width: number, height: number): void {
    this.resize(this.sourceCanvas, width, height);
    const image = this.sourceContext.createImageData(width, height);
    for (let i = 0; i < confidence.length; i++) {
      const offset = i * 4;
      image.data[offset] = 255;
      image.data[offset + 1] = 255;
      image.data[offset + 2] = 255;
      image.data[offset + 3] = Math.min(255, confidence[i]! * 255) | 0;
    }
    this.sourceContext.putImageData(image, 0, 0);
  }

  private readTargetCanvas(timestamp: number, width: number, height: number): PersonSegmentationMask {
    this.resize(this.targetCanvas, width, height);
    this.targetContext.clearRect(0, 0, width, height);
    this.targetContext.drawImage(this.sourceCanvas, 0, 0, width, height);
    const image = this.targetContext.getImageData(0, 0, width, height);
    const alpha = new Uint8Array(width * height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = image.data[i * 4 + 3]!;
    return { t: timestamp, alpha, width, height };
  }

  private resize(canvas: OffscreenCanvas, width: number, height: number): void {
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }

  private requireContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) throw new Error('OffscreenCanvas 2D context is unavailable');
    return context;
  }
}
