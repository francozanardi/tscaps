import type { MediaPipeWasmFiles } from '@core/person-segmentation/infrastructure/MediaPipeWasmFiles';

/**
 * Where the worker fetches MediaPipe's Tasks Vision bundle and its two
 * models from, and which backend runs them.
 *
 * Locations are a deployment choice, not a property of the detector. The
 * values reach MediaPipe unchanged, so they must be resolvable from the
 * worker's origin.
 *
 * Both WebAssembly builds are named because which one to load depends on
 * whether the runtime supports SIMD, and that is only answerable inside
 * the worker.
 */
export interface PersonSegmenterModelLocations {
  readonly wasmSimd: MediaPipeWasmFiles;
  readonly wasmNoSimd: MediaPipeWasmFiles;
  readonly poseModelUrl: string;
  readonly segmenterModelUrl: string;
  /**
   * `GPU` needs WebGL2 inside the worker; `CPU` runs anywhere and is
   * the only option where WebGL2 is missing or software-emulated.
   */
  readonly delegate: 'CPU' | 'GPU';
}
