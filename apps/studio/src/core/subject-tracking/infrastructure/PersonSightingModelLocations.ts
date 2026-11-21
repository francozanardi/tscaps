import type { MediaPipeWasmFiles } from '@core/person-segmentation/infrastructure/MediaPipeWasmFiles';

/**
 * Where the sighting worker reads MediaPipe and its two models from:
 * the pose landmarker, which finds bodies, and the face detector, which
 * finds the faces of a close-up the pose landmarker misses. Both
 * WebAssembly builds are named because whether the runtime supports
 * SIMD is only answerable inside the worker.
 */
export interface PersonSightingModelLocations {
  readonly wasmSimd: MediaPipeWasmFiles;
  readonly wasmNoSimd: MediaPipeWasmFiles;
  readonly poseModelUrl: string;
  readonly faceModelUrl: string;
}
