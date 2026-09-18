import { afterEach, describe, expect, it, vi } from 'vitest';
import { FetchBlobDownloader } from '@core/_shared/infrastructure/FetchBlobDownloader';

/**
 * The progress fractions this class emits are what a reader watches
 * while a project opens, and the outcome it returns is what decides
 * between offering a retry and telling them the bytes are gone. Both
 * are read off a `Response` whose shape varies with what the origin
 * chose to send, so the cases below are the responses, not the code.
 */

/** A response that streams `chunks`, advertising `contentLength` when given. */
function streamingResponse(chunks: string[], contentLength: number | null): Response {
  const encoded = chunks.map((chunk) => new TextEncoder().encode(chunk));
  let next = 0;
  return {
    ok: true,
    status: 200,
    headers: new Headers(contentLength === null ? {} : { 'content-length': String(contentLength) }),
    body: {
      getReader: () => ({
        read: () => Promise.resolve(
          next < encoded.length
            ? { value: encoded[next++], done: false }
            : { value: undefined, done: true },
        ),
      }),
    },
    blob: () => Promise.resolve(new Blob(chunks)),
  } as unknown as Response;
}

function errorResponse(status: number): Response {
  return { ok: false, status, headers: new Headers() } as unknown as Response;
}

function respondWith(response: Response | Error): void {
  vi.stubGlobal('fetch', () => (response instanceof Error
    ? Promise.reject(response)
    : Promise.resolve(response)));
}

describe('FetchBlobDownloader', () => {
  const downloader = new FetchBlobDownloader();

  afterEach(() => { vi.unstubAllGlobals(); });

  it('reports the received fraction and returns every byte', async () => {
    respondWith(streamingResponse(['abcd', 'efgh'], 8));
    const seen: (number | null)[] = [];

    const outcome = await downloader.download('https://example.test/v.mp4', (p) => seen.push(p));

    expect(seen).toEqual([0, 0.5, 1]);
    expect(outcome.kind).toBe('ok');
    expect(outcome.kind === 'ok' && await outcome.blob.text()).toBe('abcdefgh');
  });

  it('reports null throughout when the origin advertises no size, so a caller can tell moving bytes from a stalled start', async () => {
    respondWith(streamingResponse(['abcd', 'efgh'], null));
    const seen: (number | null)[] = [];

    await downloader.download('https://example.test/v.mp4', (p) => seen.push(p));

    expect(seen).toEqual([null, null, null]);
  });

  it('still returns the bytes when nobody asked for progress', async () => {
    respondWith(streamingResponse(['abcdefgh'], 8));

    const outcome = await downloader.download('https://example.test/v.mp4');

    expect(outcome.kind === 'ok' && await outcome.blob.text()).toBe('abcdefgh');
  });

  it('calls a 5xx retry-worthy, because the bytes are still there', async () => {
    respondWith(errorResponse(503));

    expect(await downloader.download('https://example.test/v.mp4')).toEqual({ kind: 'server-error' });
  });

  it('calls a 4xx gone, because there is nothing at that URL to wait for', async () => {
    respondWith(errorResponse(404));

    expect(await downloader.download('https://example.test/v.mp4')).toEqual({ kind: 'gone' });
  });

  it('treats a request that died in transport as retry-worthy, not as an absence', async () => {
    respondWith(new TypeError('Failed to fetch'));

    expect(await downloader.download('https://example.test/v.mp4')).toEqual({ kind: 'server-error' });
  });

  it('re-throws an abort, which is the caller no longer wanting an answer', async () => {
    const controller = new AbortController();
    controller.abort();
    respondWith(new DOMException('The operation was aborted.', 'AbortError'));

    await expect(
      downloader.download('https://example.test/v.mp4', undefined, controller.signal),
    ).rejects.toBeInstanceOf(DOMException);
  });
});
