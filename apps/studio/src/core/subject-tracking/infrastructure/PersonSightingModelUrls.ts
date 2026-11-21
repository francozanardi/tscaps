import { PersonSegmenterModelUrls } from '@core/person-segmentation/infrastructure/PersonSegmenterModelUrls';
import type { PersonSightingModelLocations } from '@core/subject-tracking/infrastructure/PersonSightingModelLocations';

/**
 * Where a page served to a browser reads the sighting models from: the
 * MediaPipe runtime and pose model the text behind the actor already
 * loads, so a browser that cached them for one reuses them for the
 * other, and the face detector's short-range model beside them.
 */
export class PersonSightingModelUrls {
  static readonly FACE_DETECTOR = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite';

  static readonly DEFAULT: PersonSightingModelLocations = {
    wasmSimd: PersonSegmenterModelUrls.WASM_SIMD,
    wasmNoSimd: PersonSegmenterModelUrls.WASM_NO_SIMD,
    poseModelUrl: PersonSegmenterModelUrls.POSE_LANDMARKER,
    faceModelUrl: PersonSightingModelUrls.FACE_DETECTOR,
  };
}
