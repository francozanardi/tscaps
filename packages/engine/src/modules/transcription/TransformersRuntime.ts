import type * as Transformers from '@huggingface/transformers';
import type { ModelAssetSources } from '@modules/transcription/ModelAssetSources';

/**
 * The inference library, loaded on first use and configured once.
 *
 * It is reached through a dynamic import because a static one makes the
 * whole ONNX runtime a dependency of merely *naming* a transcriber: the
 * package's entry point re-exports this module, so a consumer that
 * imports a document node pulls the runtime with it. In a browser that
 * is a large bundle nobody asked for; in Node it is a native binding
 * loaded — and on musl, failed — for code that never runs inference.
 *
 * The environment settings live here rather than at the call site
 * because they have to be applied before the first pipeline is built and
 * exactly once. Holding the module and the settings together is what
 * makes "loaded" and "configured" the same event.
 *
 * A failed load is not cached: the import can fail on a dead network the
 * same way the weights can, and a caller retrying deserves to reach the
 * network again.
 */
export class TransformersRuntime {
  private modulePromise: Promise<typeof Transformers> | null = null;

  constructor(private readonly assetSources: ModelAssetSources = {}) {}

  /**
   * Resolves with the library, configured. Concurrent callers share one
   * load, and the settings are applied before any of them sees it.
   */
  load(): Promise<typeof Transformers> {
    if (this.modulePromise === null) {
      const attempt = import('@huggingface/transformers').then((module) => {
        this.configure(module.env);
        return module;
      });
      attempt.catch(() => {
        if (this.modulePromise === attempt) this.modulePromise = null;
      });
      this.modulePromise = attempt;
    }
    return this.modulePromise;
  }

  private configure(env: typeof Transformers.env): void {
    env.allowLocalModels = false;
    this.installModelFileCache(env);
    this.installModelFileFetcher(env);
    this.installOnnxWasmFiles(env);
    this.configureWasmThreading(env);
  }

  /**
   * Takes over where the downloaded model files are kept.
   *
   * Left to itself the library picks a store from the environment and
   * discards a refused write with nothing but a console warning, so a
   * caller that wants to know when the files did not survive the run
   * has to own the store. Without one, that default stands.
   */
  private installModelFileCache(env: typeof Transformers.env): void {
    if (!this.assetSources.fileCache) return;
    env.useCustomCache = true;
    env.customCache = this.assetSources.fileCache;
  }

  /**
   * Takes over how model files are requested.
   *
   * The library's own default is a bare `fetch`, whose rejection says
   * only that something went wrong somewhere. Owning the request is
   * what lets a host that cannot be reached be named as such, and what
   * lets a second route to the same bytes exist at all.
   */
  private installModelFileFetcher(env: typeof Transformers.env): void {
    const fetcher = this.assetSources.fileFetcher;
    if (!fetcher) return;
    env.fetch = (input, init) => fetcher.fetch(input.toString(), init);
  }

  /**
   * Takes over where the inference runtime's WebAssembly backend is
   * served from.
   *
   * The runtime otherwise reaches a public package host for a binary of
   * tens of megabytes, on the critical path of the first transcription.
   * Setting both members of the pair is what the runtime checks before
   * it will fetch and hold the binary itself, so a partial override is
   * the same as none.
   */
  private installOnnxWasmFiles(env: typeof Transformers.env): void {
    const files = this.assetSources.onnxWasmFiles;
    if (!files) return;
    const wasm = env.backends.onnx.wasm;
    if (!wasm) return;
    wasm.wasmPaths = { mjs: files.mjs, wasm: files.wasm };
  }

  /**
   * Raises the WASM thread count above ORT's built-in ceiling when the
   * runtime supports it. ORT locks the count to 1 without cross-origin
   * isolation, and even with isolation its own default caps at 4 no matter
   * the machine — Whisper's encoder scales past that. On a WebGPU run this
   * has no effect; the WASM backend is not touched.
   */
  private configureWasmThreading(env: typeof Transformers.env): void {
    if (typeof self === 'undefined' || !self.crossOriginIsolated) return;
    const wasm = env.backends.onnx.wasm;
    if (!wasm) return;
    wasm.numThreads = Math.min(navigator.hardwareConcurrency || 4, 8);
  }
}
