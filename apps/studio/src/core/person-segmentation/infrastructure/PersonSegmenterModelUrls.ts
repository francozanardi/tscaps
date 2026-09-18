import visionSimdLoaderUrl from '@mediapipe-runtime/vision_wasm_internal.js?url';
import visionSimdBinaryUrl from '@mediapipe-runtime/vision_wasm_internal.wasm?url';
import visionNoSimdLoaderUrl from '@mediapipe-runtime/vision_wasm_nosimd_internal.js?url';
import visionNoSimdBinaryUrl from '@mediapipe-runtime/vision_wasm_nosimd_internal.wasm?url';
import type { MediaPipeWasmFiles } from '@core/person-segmentation/infrastructure/MediaPipeWasmFiles';

/**
 * Where the worker reads MediaPipe from. Frozen at build time, so
 * callers do not embed the literals.
 *
 * The runtime is served from this origin: it ships in the package the
 * app already depends on, so reaching a third party for it would be a
 * request on the critical path of a feature that needs none, made by
 * the surface that promises not to make any.
 */
export class PersonSegmenterModelUrls {
  static readonly WASM_SIMD: MediaPipeWasmFiles = {
    loaderUrl: visionSimdLoaderUrl,
    binaryUrl: visionSimdBinaryUrl,
  };

  static readonly WASM_NO_SIMD: MediaPipeWasmFiles = {
    loaderUrl: visionNoSimdLoaderUrl,
    binaryUrl: visionNoSimdBinaryUrl,
  };

  static readonly POSE_LANDMARKER = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';
  static readonly SELFIE_SEGMENTER = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
}
