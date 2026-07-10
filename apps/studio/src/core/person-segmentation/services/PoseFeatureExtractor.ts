import type { PoseLandmark } from '@core/person-segmentation/domain/PoseLandmark';
import type { PoseBodyPart, PoseFeatures } from '@core/person-segmentation/domain/PoseFeatures';

/** Indices into MediaPipe's pose landmark array. */
const HEAD_LANDMARK_INDICES: ReadonlyArray<number> = [0, 2, 5, 7, 8];
const SHOULDER_LANDMARK_INDICES: ReadonlyArray<number> = [11, 12];
const HIP_LANDMARK_INDICES: ReadonlyArray<number> = [23, 24];

/**
 * Converts a raw MediaPipe pose landmark array into the head /
 * shoulders / hips grouping the scene-validity rules operate on.
 * Returns `null` when the detector produced no poses for the frame.
 */
export class PoseFeatureExtractor {

  extract(landmarks: ReadonlyArray<PoseLandmark>): PoseFeatures | null {
    if (landmarks.length === 0) return null;
    return {
      landmarks,
      head: this.headPart(landmarks),
      shoulders: this.pairPart(landmarks, SHOULDER_LANDMARK_INDICES),
      hips: this.pairPart(landmarks, HIP_LANDMARK_INDICES),
    };
  }

  private headPart(landmarks: ReadonlyArray<PoseLandmark>): PoseBodyPart {
    let bestVisibility = 0;
    let bestPoint: PoseLandmark | null = null;
    for (const index of HEAD_LANDMARK_INDICES) {
      const point = landmarks[index];
      if (point === undefined) continue;
      if (point.visibility > bestVisibility) {
        bestVisibility = point.visibility;
        bestPoint = point;
      }
    }
    const points = bestPoint === null ? [] : [bestPoint];
    const midpoint = bestPoint === null ? { x: 0, y: 0 } : { x: bestPoint.x, y: bestPoint.y };
    return { visibility: bestVisibility, points, midpoint };
  }

  private pairPart(landmarks: ReadonlyArray<PoseLandmark>, indices: ReadonlyArray<number>): PoseBodyPart {
    const first = landmarks[indices[0] ?? -1];
    const second = landmarks[indices[1] ?? -1];
    if (first === undefined || second === undefined) {
      return { visibility: 0, points: [], midpoint: { x: 0, y: 0 } };
    }
    const minimumVisibility = Math.min(first.visibility, second.visibility);
    const midpoint = {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };
    return { visibility: minimumVisibility, points: [first, second], midpoint };
  }
}
