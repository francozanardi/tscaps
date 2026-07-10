/**
 * URLs and paths the worker needs to load MediaPipe's Tasks Vision
 * bundle. Frozen at build time. Bumping the model version happens
 * here, so callers do not embed the URL literals.
 */
export class PersonSegmenterModelUrls {
  static readonly WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
  static readonly POSE_LANDMARKER = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';
  static readonly SELFIE_SEGMENTER = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
}
