import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';

/**
 * Called repeatedly during proxy generation with a normalized
 * progress value in `[0, 1]`. `1` indicates the encoder has
 * processed the full input — the `generate` promise still has
 * minor finalization work to do before resolving.
 */
export type PreviewProxyProgressCallback = (progress: number) => void;

/**
 * Produces a {@link PreviewProxy} from a source video. The
 * implementation owns every encoding choice (target dimensions,
 * codec, bitrate); callers only supply the bytes.
 *
 * Generation is CPU- and time-heavy on large inputs. Callers
 * should treat each call as the only work the main thread is
 * doing for a while and run it inside a blocking pipeline step
 * with a visible splash, not as a side effect during interactive
 * work. Optionally pass `onProgress` to drive a progress bar.
 */
export interface PreviewProxyGenerator {
  generate(source: Blob, onProgress?: PreviewProxyProgressCallback): Promise<PreviewProxy>;
}
