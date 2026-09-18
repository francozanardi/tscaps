import {
  WhisperTranscriber,
  PreDecodedAudioDecoder,
  CacheStorageModelFileCache,
  DirectModelFileFetcher,
  RelayFallbackModelFileFetcher,
  type ModelAssetSources,
  type ModelFileFetcher,
  type OnnxRuntimeWasmFiles,
  type WhisperTranscriberConfig,
} from '@tscaps/engine';
import asyncifyWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import asyncifyModuleUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';
import plainWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import plainModuleUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import { UserAgentInspector } from '@shared/browser';
import { TranscriberWorkerHost } from '@core/transcription/infrastructure/workers/TranscriberWorkerHost';
import { WorkerUncaughtErrorForwarder } from '@core/_shared/workers/WorkerUncaughtErrorForwarder';

new WorkerUncaughtErrorForwarder('whisper-worker').install();

// The inference runtime ships one WebAssembly build that unwinds the
// stack through Asyncify and one that does not. Safari is the runtime
// the plain build exists for; every other browser takes the Asyncify
// one. Serving both ourselves keeps the first transcription off a
// public package host, which is a third-party request on the critical
// path of the surface that promises not to make any, and is out of
// reach on some networks entirely.
const onnxWasmFiles: OnnxRuntimeWasmFiles = new UserAgentInspector().getBrowser() === 'safari'
  ? { mjs: plainModuleUrl, wasm: plainWasmUrl }
  : { mjs: asyncifyModuleUrl, wasm: asyncifyWasmUrl };

// Model weights come from the host that publishes them, and that host
// is blocked outright on some networks. A relay of our own is a second
// way to the same files for whoever cannot reach it. Builds with none
// configured stay on the single route.
const modelRelayBaseUrl = (import.meta.env.VITE_MODEL_RELAY as string | undefined)?.trim();
const directFetcher = new DirectModelFileFetcher();
const fileFetcher: ModelFileFetcher = modelRelayBaseUrl
  ? new RelayFallbackModelFileFetcher(
    directFetcher,
    new URL(modelRelayBaseUrl, self.location.origin).toString(),
    (origin, cause) => host.reportHostUnreachable(origin, cause),
  )
  : directFetcher;

// Built once rather than per transcriber, so switching model or backend
// keeps what the session has learned: which files are already stored,
// and which of the two routes to them still works.
const assetSources: ModelAssetSources = {
  fileCache: new CacheStorageModelFileCache((error) => host.reportAssetsNotKept(error)),
  fileFetcher,
  onnxWasmFiles,
};

const host: TranscriberWorkerHost = new TranscriberWorkerHost(
  (config) => new WhisperTranscriber(
    new PreDecodedAudioDecoder(),
    config as WhisperTranscriberConfig | undefined,
    assetSources,
  ),
);
host.start();
