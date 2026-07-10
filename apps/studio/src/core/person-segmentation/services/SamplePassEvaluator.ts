import { PersonSegmentationThresholds } from '@core/person-segmentation/domain/PersonSegmentationThresholds';
import type { PoseFeatures } from '@core/person-segmentation/domain/PoseFeatures';

/**
 * Immutable inputs the evaluator judges: a single sampled frame's
 * pose, its blur / motion measurements, and the drift with respect to
 * the previous sample's shoulders. All values are already computed by
 * upstream calculators.
 */
export interface FrameSampleMeasurements {
  readonly features: PoseFeatures | null;
  readonly frameBlur: number;
  readonly personBlur: number;
  readonly frameMotion: number;
  readonly shoulderDriftPercent: number;
}

/**
 * Applies the fixed scene-validity thresholds to a single sampled
 * frame. Answers a boolean — either every criterion passes or the
 * frame is out. The upstream window finder is responsible for turning
 * a sequence of pass / fail decisions into time ranges.
 */
export class SamplePassEvaluator {

  passes(measurements: FrameSampleMeasurements): boolean {
    return (
      this.personPasses(measurements.features)
      && this.motionPasses(measurements.frameMotion, measurements.shoulderDriftPercent)
      && this.blurPasses(measurements.frameBlur, measurements.personBlur)
    );
  }

  private personPasses(features: PoseFeatures | null): boolean {
    if (features === null) return false;
    if (PersonSegmentationThresholds.REQUIRE_HEAD && features.head.visibility < PersonSegmentationThresholds.LANDMARK_VISIBILITY_MIN) return false;
    if (PersonSegmentationThresholds.REQUIRE_SHOULDERS && features.shoulders.visibility < PersonSegmentationThresholds.LANDMARK_VISIBILITY_MIN) return false;
    if (PersonSegmentationThresholds.REQUIRE_HIPS && features.hips.visibility < PersonSegmentationThresholds.LANDMARK_VISIBILITY_MIN) return false;
    return true;
  }

  private motionPasses(frameMotion: number, shoulderDriftPercent: number): boolean {
    if (frameMotion > PersonSegmentationThresholds.MOTION_MAX) return false;
    if (shoulderDriftPercent > PersonSegmentationThresholds.SHOULDER_DRIFT_MAX_PERCENT) return false;
    return true;
  }

  private blurPasses(frameBlur: number, personBlur: number): boolean {
    if (frameBlur < PersonSegmentationThresholds.FRAME_BLUR_MIN) return false;
    if (personBlur < PersonSegmentationThresholds.PERSON_BLUR_MIN) return false;
    return true;
  }
}
