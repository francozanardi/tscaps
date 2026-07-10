import type { GrayscaleFrame } from '@core/person-segmentation/domain/GrayscaleFrame';

/**
 * Mean absolute pixel-value difference between two grayscale frames
 * of matching resolution. Higher values mean more motion between the
 * frames; the calculator returns `0` when there is no previous frame
 * to compare against.
 */
export class FrameMotionCalculator {

  meanAbsoluteDifference(current: GrayscaleFrame, previous: GrayscaleFrame | null): number {
    if (previous === null) return 0;
    if (previous.width !== current.width || previous.height !== current.height) return 0;
    const size = current.data.length;
    let sum = 0;
    for (let i = 0; i < size; i++) {
      sum += Math.abs(current.data[i]! - previous.data[i]!);
    }
    return sum / size;
  }
}
