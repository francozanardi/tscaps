import type { RenderOutputChunk } from '@tscaps/engine';

/**
 * Owns the sink the preview-proxy generator writes to, and produces
 * the final blob once the mediabunny encode is done. Split from the
 * generator so the same encoding pipeline can stage the output in JS
 * heap (fast, small footprint) or in OPFS via a worker (large
 * footprint, keeps mobile tabs away from the OOM killer).
 *
 * A strategy is single-use: `open` → hand writable to the transcode
 * coordinator → `collect` after execute returns → `dispose`. Callers
 * must call `dispose` on both success and failure paths; `dispose`
 * is idempotent.
 */
export interface PreviewProxyOutputStrategy {
  /**
   * Prepares the underlying sink and returns the writable stream the
   * caller hands to the transcode coordinator as `outputStream`. Must
   * be called before the transcode starts.
   */
  open(mimeType: string): Promise<WritableStream<RenderOutputChunk>>;

  /**
   * Produces the final proxy blob after the transcode has finished
   * writing to the sink. Throws when called before `open` or when the
   * underlying sink produced no data.
   */
  collect(): Promise<Blob>;

  /**
   * Releases any workers, file handles, or staged files owned by
   * the strategy. Idempotent.
   */
  dispose(): void;
}
