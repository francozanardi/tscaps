import type { PoseFeatures } from '@core/person-segmentation/domain/PoseFeatures';
import type { NormalizedBbox } from '@core/person-segmentation/domain/NormalizedBbox';

const PADDING = 0.05;
const MINIMUM_VISIBILITY = 0.3;
const MINIMUM_POINTS = 3;

/**
 * Bounding box, in normalised frame coordinates, that encloses the
 * pose's visible landmarks with a small margin around them. Returns
 * `null` when fewer than a few points meet the visibility floor —
 * such poses do not produce a meaningful person region.
 */
export class PersonBboxCalculator {

  compute(features: PoseFeatures | null): NormalizedBbox | null {
    if (features === null) return null;
    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;
    let count = 0;
    for (const point of features.landmarks) {
      if ((point.visibility ?? 1) < MINIMUM_VISIBILITY) continue;
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
      count++;
    }
    if (count < MINIMUM_POINTS) return null;
    return {
      minX: Math.max(0, minX - PADDING),
      minY: Math.max(0, minY - PADDING),
      maxX: Math.min(1, maxX + PADDING),
      maxY: Math.min(1, maxY + PADDING),
    };
  }
}
