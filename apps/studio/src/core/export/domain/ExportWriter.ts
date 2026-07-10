import type { OutputFormat, RenderOutputChunk } from '@tscaps/engine';

/**
 * Destination for the encoded bytes of an export. The consumer hands
 * {@link stream} to the renderer; the writer routes those bytes to its
 * underlying medium (a user-picked disk file, OPFS, etc.).
 *
 * Lifecycle is single-shot: {@link open} once, render, then either
 * {@link finalize} or {@link abort}, then {@link dispose}.
 */
export interface ExportWriter {
  open(format: OutputFormat): Promise<void>;
  stream(): WritableStream<RenderOutputChunk>;
  /**
   * Returns the file the caller should hand to a browser download when
   * the writer kept the bytes inside the app (e.g. staged on OPFS).
   * `null` when the writer already delivered the output to its final
   * location during the render (e.g. wired straight to the user's
   * chosen disk file) and no further user-visible step is needed.
   */
  finalize(): Promise<File | null>;
  abort(): Promise<void>;
  dispose(): void;
}
