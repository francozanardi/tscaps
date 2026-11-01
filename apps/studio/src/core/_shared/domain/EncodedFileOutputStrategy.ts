import type { RenderOutputChunk } from '@tscaps/engine';

/**
 * Owns the sink an encoding run writes to, and produces the finished
 * file's blob once the mediabunny encode is done. Split from the
 * encoder so the same pipeline can stage its output in the JS heap
 * (fast, small footprint) or in OPFS via a worker (large footprint,
 * keeps mobile tabs away from the OOM killer).
 *
 * A strategy is single-use: `open` → hand writable to the transcode
 * coordinator → `collect` after execute returns → `dispose`. Callers
 * must call `dispose` on both success and failure paths; `dispose`
 * is idempotent.
 */
export interface EncodedFileOutputStrategy {
  /**
   * Prepares the underlying sink and returns the writable stream the
   * caller hands to the transcode coordinator as `outputStream`. Must
   * be called before the transcode starts.
   */
  open(mimeType: string): Promise<WritableStream<RenderOutputChunk>>;

  /**
   * Produces the finished file's blob after the transcode has finished
   * writing to the sink. Throws when called before `open` or when the
   * underlying sink produced no data.
   */
  collect(): Promise<Blob>;

  /**
   * Releases any workers, file handles, or staged files owned by
   * the strategy. A blob already collected stays readable. Idempotent.
   */
  dispose(): void;
}
