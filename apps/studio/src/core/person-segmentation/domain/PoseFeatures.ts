import type { PoseLandmark } from '@core/person-segmentation/domain/PoseLandmark';

/**
 * The subset of pose data the scene-validity rules operate on.
 * Extracted from the raw landmark array once so downstream services
 * do not re-derive body parts.
 */
export interface PoseFeatures {
  readonly landmarks: ReadonlyArray<PoseLandmark>;
  readonly head: PoseBodyPart;
  readonly shoulders: PoseBodyPart;
  readonly hips: PoseBodyPart;
}

export interface PoseBodyPart {
  /** Minimum visibility across the part's landmarks, or the best-visibility landmark for single-point parts. */
  readonly visibility: number;
  readonly points: ReadonlyArray<PoseLandmark>;
  readonly midpoint: { readonly x: number; readonly y: number };
}
