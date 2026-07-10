import type { PersonSegmentationMask } from '@core/person-segmentation/domain/PersonSegmentationMask';

/**
 * Builds and caches a canvas whose alpha channel holds the mask's
 * opacity bytes. Subsequent calls with the same mask return the same
 * canvas without repainting; a different mask replaces the cache
 * atomically. Consumers upscale via `drawImage` at composite time.
 */
export class ActorMaskCanvasBuilder {
  private cachedMask: PersonSegmentationMask | null = null;
  private cachedCanvas: OffscreenCanvas | null = null;
  private cachedContext: OffscreenCanvasRenderingContext2D | null = null;

  ensure(mask: PersonSegmentationMask): OffscreenCanvas {
    if (this.cachedMask === mask && this.cachedCanvas !== null) return this.cachedCanvas;
    const canvas = this.resolveCanvas(mask.width, mask.height);
    const context = this.resolveContext(canvas);
    const image = context.createImageData(mask.width, mask.height);
    this.paintAlphaBytes(image, mask.alpha);
    context.putImageData(image, 0, 0);
    this.cachedMask = mask;
    return canvas;
  }

  private resolveCanvas(width: number, height: number): OffscreenCanvas {
    if (this.cachedCanvas === null || this.cachedCanvas.width !== width || this.cachedCanvas.height !== height) {
      this.cachedCanvas = new OffscreenCanvas(width, height);
      this.cachedContext = null;
    }
    return this.cachedCanvas;
  }

  private resolveContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
    if (this.cachedContext !== null) return this.cachedContext;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('OffscreenCanvas 2D context is unavailable');
    this.cachedContext = context;
    return context;
  }

  private paintAlphaBytes(image: ImageData, alpha: Uint8Array): void {
    for (let i = 0; i < alpha.length; i++) {
      const offset = i * 4;
      image.data[offset] = 255;
      image.data[offset + 1] = 255;
      image.data[offset + 2] = 255;
      image.data[offset + 3] = alpha[i]!;
    }
  }
}
