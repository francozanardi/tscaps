/**
 * Receives the fraction of a download that has landed, in `[0, 1]`,
 * or `null` when the transport could not advertise a total size.
 * Called once before the first byte and again on every chunk.
 */
export type BlobDownloadProgressCallback = (progress: number | null) => void;

/**
 * How a download ended.
 *
 * - `ok`: the bytes landed whole.
 * - `server-error`: the origin answered 5xx, or the request died in
 *   transport. The bytes are still there; a retry is worth offering.
 * - `gone`: the origin answered with a client error (4xx), which
 *   means there is nothing at this URL to wait for.
 */
export type BlobDownload =
  | { readonly kind: 'ok'; readonly blob: Blob }
  | { readonly kind: 'server-error' }
  | { readonly kind: 'gone' };

/**
 * Reads a URL into a `Blob`, reporting how much has landed.
 *
 * Never throws for a failed download — every outcome is carried in
 * the returned {@link BlobDownload}, so a caller decides on the
 * remedy rather than on an exception. The one exception is an abort,
 * which is re-thrown: the caller asked for the request to stop and is
 * not waiting for an answer.
 */
export interface BlobDownloader {
  download(
    url: string,
    onProgress?: BlobDownloadProgressCallback,
    signal?: AbortSignal,
  ): Promise<BlobDownload>;
}
