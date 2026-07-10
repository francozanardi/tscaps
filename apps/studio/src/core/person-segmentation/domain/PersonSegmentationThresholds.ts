/**
 * Fixed thresholds the detector applies to decide whether a sampled
 * frame is scene-valid for the text-behind-actor effect. Values match
 * the tuned defaults from the eval harness — a template author cannot
 * override them in v1.
 */
export class PersonSegmentationThresholds {
  static readonly MOTION_MAX = 20;
  static readonly SHOULDER_DRIFT_MAX_PERCENT = 5;
  static readonly FRAME_BLUR_MIN = 1000;
  static readonly PERSON_BLUR_MIN = 1000;
  static readonly LANDMARK_VISIBILITY_MIN = 0.85;
  static readonly WINDOW_DURATION_MIN_SEC = 1.0;
  static readonly REQUIRE_HEAD = true;
  static readonly REQUIRE_SHOULDERS = true;
  static readonly REQUIRE_HIPS = false;
}
