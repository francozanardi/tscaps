import type { GeneratedPreviewProxy } from '@core/preview/domain/GeneratedPreviewProxy';

/**
 * Called repeatedly during proxy generation with a normalized
 * progress value in `[0, 1]`. `1` indicates the encoder has
 * processed the full input — the `generate` promise still has
 * minor finalization work to do before resolving.
 */
export type PreviewProxyProgressCallback = (progress: number) => void;

/**
 * Produces a preview proxy from a source video, and where its picture
 * changes abruptly, noticed on the way. The implementation owns every
 * encoding choice (target dimensions, codec, bitrate); callers only
 * supply the bytes.
 *
 * Generation is CPU- and time-heavy on large inputs, and its encode
 * loop shares the main thread with whatever else is running, so a
 * long run in the background can make the editor less smooth while
 * it lasts. Optionally pass `onProgress` to drive a progress bar.
 *
 * `signal` abandons a run in flight, rejecting with an `AbortError`
 * left unwrapped so callers can tell it from a generation failure.
 * Partial output is discarded and cannot be resumed.
 */
export interface PreviewProxyGenerator {
  generate(
    source: Blob,
    onProgress?: PreviewProxyProgressCallback,
    signal?: AbortSignal,
  ): Promise<GeneratedPreviewProxy>;
}
