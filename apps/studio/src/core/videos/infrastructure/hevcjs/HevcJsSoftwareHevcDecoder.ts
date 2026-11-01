import type { SoftwareHevcDecoder } from '@core/videos/domain/SoftwareHevcDecoder';
import { HevcJsRuntimeUrls } from '@core/videos/infrastructure/hevcjs/HevcJsRuntimeUrls';

/**
 * hevc.js (`@hevcjs/mediabunny-plugin`): a WebAssembly HEVC decoder,
 * single-threaded, registered with mediabunny as a custom decoder.
 * Each track it decodes gets a Web Worker of its own.
 *
 * The plugin and its worker are only fetched on the first `install`,
 * so a page that never needs them pays nothing for them.
 *
 * Registered with `force`: the plugin's own probe asks the browser
 * about one HEVC level only (3.1), so a browser whose decoder answers
 * yes there and then fails on a larger stream would be left to that
 * decoder. Installing at all means the browser already failed on a
 * source, so from then on hevc.js takes every HEVC track.
 *
 * Picked after measuring it against ffmpeg.wasm and against decoding
 * through a `<video>` element, on the same HEVC sources.
 */
export class HevcJsSoftwareHevcDecoder implements SoftwareHevcDecoder {

  private installation: Promise<void> | null = null;

  install(): Promise<void> {
    this.installation ??= this.register().catch((error: unknown) => {
      this.installation = null;
      throw error;
    });
    return this.installation;
  }

  private async register(): Promise<void> {
    const [{ registerHevcDecoder }, workerUrl] = await Promise.all([
      import('@hevcjs/mediabunny-plugin'),
      this.workerBlobUrl(),
    ]);
    await registerHevcDecoder({
      workerUrl,
      wasmUrl: this.absolute(HevcJsRuntimeUrls.DECODER_GLUE),
      wasmBinaryUrl: this.absolute(HevcJsRuntimeUrls.DECODER_BINARY),
      force: true,
    });
  }

  /**
   * The worker starts from a blob URL, which inherits the page's
   * cross-origin isolation; a worker script served from the assets
   * folder would need the isolation headers of its own. Its source is
   * taken as text at build time rather than fetched, because the
   * development server rewrites the scripts it serves and adds a module
   * import that the classic worker the plugin starts cannot run. The
   * URL is never revoked: the plugin starts a worker from it for every
   * track it decodes, for the rest of the page's life.
   */
  private async workerBlobUrl(): Promise<string> {
    const { default: source } = await import('@hevcjs-runtime/mediabunny-plugin/dist/decode-worker.js?raw');
    return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  }

  /** The worker runs from a blob URL, which cannot resolve the relative URLs Vite may emit. */
  private absolute(url: string): string {
    return new URL(url, location.href).href;
  }
}
