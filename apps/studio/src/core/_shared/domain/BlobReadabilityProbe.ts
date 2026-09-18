/**
 * - `readable`: a read went through.
 * - `gone`: the file the blob points at is no longer there.
 * - `unreadable`: the file is there and the runtime would not read it.
 */
export type BlobReadability = 'readable' | 'gone' | 'unreadable';

/**
 * Tells whether the bytes behind a `Blob` are still readable.
 *
 * A browser keeps a stored `Blob` as a file beside its database, and a
 * picked `File` as a path the page does not own. Either way the
 * reference stays a valid `Blob` with a size and a type after the file
 * it names has gone, and only a read finds out.
 */
export interface BlobReadabilityProbe {
  probe(blob: Blob): Promise<BlobReadability>;
}
