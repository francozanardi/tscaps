import type { GrayscaleFrame } from '@core/person-segmentation/domain/GrayscaleFrame';
import type { NormalizedBbox } from '@core/person-segmentation/domain/NormalizedBbox';

/**
 * Computes the variance of the Laplacian response over a grayscale
 * frame. Used as a blur proxy: sharper frames concentrate energy in
 * high-frequency edges, so higher variance means less blur.
 */
export class LaplacianVarianceCalculator {

  fullFrame(frame: GrayscaleFrame): number {
    return this.rectangle(frame, 1, 1, frame.width - 1, frame.height - 1);
  }

  region(frame: GrayscaleFrame, bbox: NormalizedBbox): number {
    const x0 = Math.max(1, Math.floor(bbox.minX * frame.width));
    const y0 = Math.max(1, Math.floor(bbox.minY * frame.height));
    const x1 = Math.min(frame.width - 1, Math.ceil(bbox.maxX * frame.width));
    const y1 = Math.min(frame.height - 1, Math.ceil(bbox.maxY * frame.height));
    if (x1 <= x0 || y1 <= y0) return 0;
    return this.rectangle(frame, x0, y0, x1, y1);
  }

  private rectangle(frame: GrayscaleFrame, x0: number, y0: number, x1: number, y1: number): number {
    const { data, width } = frame;
    let sum = 0;
    let sumOfSquares = 0;
    let count = 0;
    for (let y = y0; y < y1; y++) {
      const row = y * width;
      for (let x = x0; x < x1; x++) {
        const i = row + x;
        const response = -4 * data[i]! + data[i - 1]! + data[i + 1]! + data[i - width]! + data[i + width]!;
        sum += response;
        sumOfSquares += response * response;
        count++;
      }
    }
    if (count === 0) return 0;
    const mean = sum / count;
    return sumOfSquares / count - mean * mean;
  }
}
