import type { ModelFileCache } from '@modules/transcription/ModelFileCache';
import type { ModelFileFetcher } from '@modules/transcription/ModelFileFetcher';
import type { OnnxRuntimeWasmFiles } from '@modules/transcription/OnnxRuntimeWasmFiles';

/**
 * Where a transcriber's downloadable assets come from and how they are
 * reached.
 *
 * Every member is optional and every one of them falls back to the
 * inference library's own default. Those defaults reach hosts the
 * library chose, which a consumer serving its own copies, or serving
 * an audience that cannot reach them, will want to replace.
 */
export interface ModelAssetSources {
  /** Where downloaded model files are kept between runs. */
  readonly fileCache?: ModelFileCache;

  /** How model files are requested. */
  readonly fileFetcher?: ModelFileFetcher;

  /** Where the inference runtime's WebAssembly backend is served from. */
  readonly onnxWasmFiles?: OnnxRuntimeWasmFiles;
}
