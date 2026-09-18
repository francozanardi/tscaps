import type {
  BlobDownload,
  BlobDownloadProgressCallback,
  BlobDownloader,
} from '@core/_shared/domain/BlobDownloader';

/**
 * `BlobDownloader` over the Fetch API. Streams the response body so
 * progress can be reported per chunk; without a progress callback, or
 * against a response that carries no readable body, it reads the blob
 * in one step instead.
 *
 * Progress is a fraction of `content-length`. A response that does not
 * advertise one still reports — with `null` — so a caller can tell
 * "bytes are moving, size unknown" from "nothing started yet".
 */
export class FetchBlobDownloader implements BlobDownloader {

  async download(
    url: string,
    onProgress?: BlobDownloadProgressCallback,
    signal?: AbortSignal,
  ): Promise<BlobDownload> {
    try {
      const response = await fetch(url, signal ? { signal } : undefined);
      if (!response.ok) return this.classifyErrorResponse(response);
      const blob = (!onProgress || !response.body)
        ? await response.blob()
        : await this.streamWithProgress(response, onProgress);
      return { kind: 'ok', blob };
    } catch (error) {
      if (this.isAbort(error, signal)) throw error;
      // A URL that was handed out moments ago still points at bytes
      // that exist; what failed is the transport, and that is the same
      // "come back in a minute" as a 5xx.
      return { kind: 'server-error' };
    }
  }

  private classifyErrorResponse(response: Response): BlobDownload {
    if (response.status >= 500) return { kind: 'server-error' };
    return { kind: 'gone' };
  }

  private isAbort(error: unknown, signal: AbortSignal | undefined): boolean {
    if (signal?.aborted) return true;
    return error instanceof DOMException && error.name === 'AbortError';
  }

  private async streamWithProgress(
    response: Response,
    onProgress: BlobDownloadProgressCallback,
  ): Promise<Blob> {
    const contentType = response.headers.get('content-type') ?? '';
    const totalBytes = this.readContentLength(response);
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;
    onProgress(totalBytes === null ? null : 0);
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      chunks.push(value);
      receivedBytes += value.length;
      onProgress(totalBytes === null ? null : receivedBytes / totalBytes);
    }
    return new Blob(chunks as BlobPart[], { type: contentType });
  }

  private readContentLength(response: Response): number | null {
    const raw = response.headers.get('content-length');
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }
}
