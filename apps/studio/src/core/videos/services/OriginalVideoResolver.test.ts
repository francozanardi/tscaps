import { describe, expect, it } from 'vitest';
import type { BlobReadability, BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
import { EditorStore } from '@core/editor/store/EditorStore';
import { OriginalVideoDownloadStore } from '@core/projects/store/OriginalVideoDownloadStore';
import type { VideoBlobLookup } from '@core/videos/domain/VideoBlobLookup';
import type { OriginalVideoKeeper } from '@core/videos/services/OriginalVideoKeeper';
import { OriginalVideoResolver } from '@core/videos/services/OriginalVideoResolver';
import { OriginalVideoDownloadFailedError } from '@core/projects/domain/errors/OriginalVideoDownloadFailedError';

/**
 * The promise here is "readable bytes, or the honest reason there are
 * none". Every case below is a session that looks fine from the
 * outside — the editor is holding a file, or a copy is on record —
 * and differs only in whether those bytes can actually be read.
 */

/** Reports the readability it was told, and `readable` otherwise. */
class ListedProbe implements BlobReadabilityProbe {
  private readonly listed = new Map<Blob, BlobReadability>();
  private readonly failures = new Map<Blob, unknown>();

  mark(blob: Blob, readability: BlobReadability): void {
    this.listed.set(blob, readability);
  }

  failWith(blob: Blob, error: unknown): void {
    this.failures.set(blob, error);
  }

  probe(blob: Blob): Promise<BlobReadability> {
    const failure = this.failures.get(blob);
    if (failure) return Promise.reject(failure);
    return Promise.resolve(this.listed.get(blob) ?? 'readable');
  }
}

const substitute = <T>(stub: object): T => stub as T;

interface Harness {
  readonly resolver: OriginalVideoResolver;
  readonly store: EditorStore;
  readonly probe: ListedProbe;
  readonly downloadStore: OriginalVideoDownloadStore;
}

function buildHarness(storedCopy: VideoBlobLookup = { outcome: 'missing', reason: 'absent' }): Harness {
  const store = new EditorStore();
  const probe = new ListedProbe();
  const downloadStore = new OriginalVideoDownloadStore();
  const keeper = substitute<OriginalVideoKeeper>({ storedCopy: async () => storedCopy });
  return {
    resolver: new OriginalVideoResolver(store, probe, keeper, downloadStore),
    store,
    probe,
    downloadStore,
  };
}

function loadVideo(store: EditorStore, file: File): void {
  store.patch({
    video: { file, fileName: file.name, mimeType: file.type, size: file.size },
  });
}

const clip = () => new File(['frames'], 'clip.mp4', { type: 'video/mp4' });

describe('OriginalVideoResolver', () => {

  describe('the file the editor holds', () => {

    it('hands it back when its bytes still read', async () => {
      const harness = buildHarness();
      const file = clip();
      loadVideo(harness.store, file);

      expect(await harness.resolver.readableFileInEditor()).toBe(file);
    });

    it.each<BlobReadability>(['gone', 'unreadable'])('withholds it when a read comes back %s', async (readability) => {
      const harness = buildHarness();
      const file = clip();
      loadVideo(harness.store, file);
      harness.probe.mark(file, readability);

      expect(await harness.resolver.readableFileInEditor()).toBeNull();
    });

    it('withholds it when the read fails in a way nothing recognises, rather than raising mid-export', async () => {
      const harness = buildHarness();
      const file = clip();
      loadVideo(harness.store, file);
      harness.probe.failWith(file, new DOMException('An internal error was encountered.', 'UnknownError'));

      expect(await harness.resolver.readableFileInEditor()).toBeNull();
    });
  });

  describe('going to storage', () => {

    it('rebuilds the stored bytes under the name and type the session committed to', async () => {
      const harness = buildHarness({ outcome: 'found', blob: new Blob(['frames']), source: 'device' });
      loadVideo(harness.store, clip());

      const resolution = await harness.resolver.readableFileFromStorage();

      expect(resolution).toMatchObject({ outcome: 'found', source: 'device' });
      if (resolution.outcome !== 'found') throw new Error('unreachable');
      expect(resolution.file.name).toBe('clip.mp4');
      expect(resolution.file.type).toBe('video/mp4');
    });

    it('says the chosen file went away when it was the only copy there ever was', async () => {
      const harness = buildHarness();
      loadVideo(harness.store, clip());

      expect(await harness.resolver.readableFileFromStorage()).toEqual({ outcome: 'missing', reason: 'held-file-gone' });
    });

    it('keeps the stored reason when storage had a record of its own', async () => {
      const harness = buildHarness({ outcome: 'missing', reason: 'stored-bytes-gone' });
      loadVideo(harness.store, clip());

      expect(await harness.resolver.readableFileFromStorage()).toEqual({ outcome: 'missing', reason: 'stored-bytes-gone' });
    });
  });

  describe('a download already in flight', () => {

    it('waits for the bytes instead of reporting them missing', async () => {
      const harness = buildHarness();
      harness.downloadStore.start();
      const resolving = harness.resolver.readableFileFromStorage();

      const arrived = clip();
      loadVideo(harness.store, arrived);
      harness.downloadStore.markReady();

      expect(await resolving).toEqual({ outcome: 'found', file: arrived, source: 'memory' });
    });

    it('rejects with the failure that ended it, which owns its own banner', async () => {
      const harness = buildHarness();
      harness.downloadStore.start();
      const resolving = harness.resolver.readableFileFromStorage();
      harness.downloadStore.fail(new OriginalVideoDownloadFailedError({ cause: new Error('offline') }));

      await expect(resolving).rejects.toBeInstanceOf(OriginalVideoDownloadFailedError);
    });

    it('does not wait when no fetch was ever started, which would never resolve', async () => {
      const harness = buildHarness();
      const file = clip();
      loadVideo(harness.store, file);
      harness.probe.mark(file, 'unreadable');

      expect(await harness.resolver.readableFileFromStorage()).toEqual({ outcome: 'missing', reason: 'held-file-gone' });
    });
  });
});
