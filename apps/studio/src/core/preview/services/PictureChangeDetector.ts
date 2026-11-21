/**
 * Finds where a video's picture changes abruptly — an edit already in
 * the source, a switch of camera — from small thumbnails of its frames
 * handed over in order.
 *
 * Each frame is compared with the one before it twice: pixel by pixel,
 * which notices any change of content but also motion, and by colour
 * histogram, which ignores where things are and notices a new scene.
 * A frame is a change where that difference stands well above the
 * frames around it and above a floor of its own, so a camera that pans
 * or a speaker who moves raises the neighbourhood with it and is not
 * taken for an edit. Gradual transitions (fades, dissolves) are not
 * reported: no single frame of them stands out.
 *
 * Single use: one instance per pass over one video. Thumbnails must all
 * share one size and arrive in ascending time.
 */
export class PictureChangeDetector {
  /** Below this a difference is never a change, however still the frames around it. */
  private static readonly MIN_DIFFERENCE = 0.12;
  /** How many times the neighbourhood's difference a change must reach. */
  private static readonly MIN_RATIO_TO_NEIGHBOURS = 3;
  /** Frames either side that make the neighbourhood. */
  private static readonly NEIGHBOURHOOD_FRAMES = 2;
  /** Floor of the neighbourhood's difference, so a frozen picture does not make every flicker a change. */
  private static readonly MIN_NEIGHBOURHOOD_DIFFERENCE = 0.01;
  private static readonly HISTOGRAM_BINS_PER_CHANNEL = 8;

  private readonly timestampsSec: number[] = [];
  private readonly differences: number[] = [];
  private previousPixels: Uint8ClampedArray | null = null;
  private previousHistogram: Float64Array | null = null;

  /**
   * Takes the next frame's thumbnail as RGBA bytes, with the source time
   * the frame is shown at. The bytes are copied; the caller may reuse
   * its buffer.
   */
  observe(timestampSec: number, rgbaPixels: Uint8ClampedArray): void {
    const histogram = this.histogramOf(rgbaPixels);
    if (this.previousPixels && this.previousHistogram && this.previousPixels.length === rgbaPixels.length) {
      const pixelDifference = this.pixelDifference(this.previousPixels, rgbaPixels);
      const histogramDifference = this.histogramDifference(this.previousHistogram, histogram);
      this.timestampsSec.push(timestampSec);
      this.differences.push((pixelDifference + histogramDifference) / 2);
    }
    this.previousPixels = rgbaPixels.slice();
    this.previousHistogram = histogram;
  }

  /** The source times of the first frame of each new picture, ascending. */
  changes(): number[] {
    const changes: number[] = [];
    for (let index = 0; index < this.differences.length; index += 1) {
      if (this.isChange(index)) changes.push(this.timestampsSec[index]!);
    }
    return changes;
  }

  private isChange(index: number): boolean {
    const difference = this.differences[index]!;
    if (difference < PictureChangeDetector.MIN_DIFFERENCE) return false;
    const neighbourhood = Math.max(this.neighbourhoodDifference(index), PictureChangeDetector.MIN_NEIGHBOURHOOD_DIFFERENCE);
    return difference >= neighbourhood * PictureChangeDetector.MIN_RATIO_TO_NEIGHBOURS;
  }

  private neighbourhoodDifference(index: number): number {
    const reach = PictureChangeDetector.NEIGHBOURHOOD_FRAMES;
    let sum = 0;
    let count = 0;
    for (let other = index - reach; other <= index + reach; other += 1) {
      if (other === index || other < 0 || other >= this.differences.length) continue;
      sum += this.differences[other]!;
      count += 1;
    }
    return count > 0 ? sum / count : 0;
  }

  /** Mean absolute difference over the colour channels, in `[0, 1]`. */
  private pixelDifference(previous: Uint8ClampedArray, current: Uint8ClampedArray): number {
    let sum = 0;
    let samples = 0;
    for (let offset = 0; offset < current.length; offset += 4) {
      sum += Math.abs(current[offset]! - previous[offset]!)
        + Math.abs(current[offset + 1]! - previous[offset + 1]!)
        + Math.abs(current[offset + 2]! - previous[offset + 2]!);
      samples += 3;
    }
    return samples > 0 ? sum / (samples * 255) : 0;
  }

  /** Half the L1 distance between two normalized histograms, in `[0, 1]`. */
  private histogramDifference(previous: Float64Array, current: Float64Array): number {
    let sum = 0;
    for (let bin = 0; bin < current.length; bin += 1) {
      sum += Math.abs(current[bin]! - previous[bin]!);
    }
    return sum / 2;
  }

  /**
   * One histogram per colour channel, laid end to end and normalized so
   * the whole sums to one.
   */
  private histogramOf(rgbaPixels: Uint8ClampedArray): Float64Array {
    const bins = PictureChangeDetector.HISTOGRAM_BINS_PER_CHANNEL;
    const binWidth = 256 / bins;
    const histogram = new Float64Array(bins * 3);
    const pixels = rgbaPixels.length / 4;
    if (pixels === 0) return histogram;
    for (let offset = 0; offset < rgbaPixels.length; offset += 4) {
      histogram[Math.floor(rgbaPixels[offset]! / binWidth)]! += 1;
      histogram[bins + Math.floor(rgbaPixels[offset + 1]! / binWidth)]! += 1;
      histogram[2 * bins + Math.floor(rgbaPixels[offset + 2]! / binWidth)]! += 1;
    }
    for (let bin = 0; bin < histogram.length; bin += 1) histogram[bin]! /= pixels * 3;
    return histogram;
  }
}
