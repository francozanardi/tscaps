import decoderGlueUrl from '@hevcjs-runtime/core/dist/wasm/hevc-decode.js?url';
import decoderBinaryUrl from '@hevcjs-runtime/core/dist/wasm/hevc-decode.wasm?url';

/**
 * Where hevc.js's decoder is served from, frozen at build time. Its
 * Emscripten glue and its WebAssembly binary ship in the packages the
 * app depends on and are served from this origin, at the versions the
 * lockfile pins, never from a third-party host.
 */
export class HevcJsRuntimeUrls {
  static readonly DECODER_GLUE = decoderGlueUrl;
  static readonly DECODER_BINARY = decoderBinaryUrl;
}
