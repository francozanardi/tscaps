import type { PoseFeatures } from '@core/person-segmentation/domain/PoseFeatures';

const SHOULDER_VISIBILITY_FLOOR = 0.3;
const SHOULDER_WIDTH_PIXELS_FLOOR = 5;

/**
 * Movement of the shoulder midpoint between two consecutive poses,
 * expressed as a percentage of the current shoulder width in pixels.
 * Used as a low-motion criterion: a still actor keeps this value near
 * zero. Returns `0` when either pose lacks confident shoulder points.
 */
export class ShoulderDriftCalculator {

  percentBetween(
    current: PoseFeatures | null,
    previous: PoseFeatures | null,
    videoWidth: number,
    videoHeight: number,
  ): number {
    if (current === null || previous === null) return 0;
    if (current.shoulders.visibility < SHOULDER_VISIBILITY_FLOOR) return 0;
    if (previous.shoulders.visibility < SHOULDER_VISIBILITY_FLOOR) return 0;
    const leftShoulder = current.shoulders.points[0];
    const rightShoulder = current.shoulders.points[1];
    if (leftShoulder === undefined || rightShoulder === undefined) return 0;
    const dx = (current.shoulders.midpoint.x - previous.shoulders.midpoint.x) * videoWidth;
    const dy = (current.shoulders.midpoint.y - previous.shoulders.midpoint.y) * videoHeight;
    const drift = Math.hypot(dx, dy);
    const shoulderWidth = Math.hypot(
      (leftShoulder.x - rightShoulder.x) * videoWidth,
      (leftShoulder.y - rightShoulder.y) * videoHeight,
    );
    if (shoulderWidth < SHOULDER_WIDTH_PIXELS_FLOOR) return 0;
    return (drift / shoulderWidth) * 100;
  }
}
