import { describe, expect, it } from 'vitest';
import type { BlobReadability, BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
import type { VideoBlobLookup } from '@core/videos/domain/VideoBlobLookup';
import type { VideoBlobCache } from '@core/videos/domain/VideoBlobCache';
import { MemoryFirstVideoBlobCache } from '@core/videos/infrastructure/MemoryFirstVideoBlobCache';

/**
 * Three promises live here. The first is the one a device with no
 * room left depends on: bytes handed to the cache stay readable even
 * when the durable layer refuses them, which is what lets a project
 * upload a video its own disk would not store. The second is that
 * bytes the durable layer did keep are answered from there, because
 * the blob handed in is a picked file, and on iOS a picked file is a
 * temporary copy the system removes on its own schedule. The third is
 * that a miss says what happened, so a prompt can tell the truth.
 */

class InMemoryDurableCache implements VideoBlobCache {
  private readonly blobs = new Map<string, Blob>();

  refuseWrites = false;

  load(projectId: string): Promise<VideoBlobLookup> {
    const blob = this.blobs.get(projectId);
    return Promise.resolve(blob
      ? { outcome: 'found', blob, source: 'device' }
      : { outcome: 'missing', reason: 'absent' });
  }

  store(projectId: string, blob: Blob): Promise<void> {
    if (this.refuseWrites) {
      return Promise.reject(new DOMException('The quota has been exceeded.', 'QuotaExceededError'));
    }
    this.blobs.set(projectId, blob);
    return Promise.resolve();
  }

  delete(projectId: string): Promise<void> {
    this.blobs.delete(projectId);
    return Promise.resolve();
  }
}

/** Reports the blobs it was told will not read, and nothing else. */
class ListedBlobReadabilityProbe implements BlobReadabilityProbe {
  private readonly unreadable = new Map<Blob, BlobReadability>();

  markGone(blob: Blob): void {
    this.unreadable.set(blob, 'gone');
  }

  markUnreadable(blob: Blob): void {
    this.unreadable.set(blob, 'unreadable');
  }

  probe(blob: Blob): Promise<BlobReadability> {
    return Promise.resolve(this.unreadable.get(blob) ?? 'readable');
  }
}

describe('MemoryFirstVideoBlobCache', () => {
  const bytes = (text: string) => new Blob([text], { type: 'video/mp4' });
  const readBack = async (lookup: VideoBlobLookup) => (lookup.outcome === 'found' ? lookup.blob.text() : null);

  const build = (durable = new InMemoryDurableCache(), probe = new ListedBlobReadabilityProbe()) =>
    new MemoryFirstVideoBlobCache(durable, probe);

  it('hands the video back after the durable layer refused to keep it', async () => {
    const durable = new InMemoryDurableCache();
    const cache = build(durable);
    durable.refuseWrites = true;

    await expect(cache.store('a', bytes('frames'))).rejects.toThrow();

    const lookup = await cache.load('a');
    expect(await readBack(lookup)).toBe('frames');
    expect(lookup).toMatchObject({ outcome: 'found', source: 'memory' });
  });

  it('answers from the durable layer once it has kept the bytes', async () => {
    const durable = new InMemoryDurableCache();
    const cache = build(durable);

    await cache.store('a', bytes('frames'));

    const lookup = await cache.load('a');
    expect(await readBack(lookup)).toBe('frames');
    expect(lookup).toMatchObject({ outcome: 'found', source: 'device' });
  });

  it('holds one project at a time', async () => {
    const durable = new InMemoryDurableCache();
    const cache = build(durable);
    durable.refuseWrites = true;
    await cache.store('a', bytes('first')).catch(() => undefined);

    await cache.store('b', bytes('second')).catch(() => undefined);

    expect(await cache.load('a')).toEqual({ outcome: 'missing', reason: 'absent' });
    expect(await readBack(await cache.load('b'))).toBe('second');
  });

  it('reads through to the durable layer for a project it is not holding', async () => {
    const durable = new InMemoryDurableCache();
    await durable.store('a', bytes('from disk'));

    const cache = build(durable);

    expect(await readBack(await cache.load('a'))).toBe('from disk');
  });

  it('says the chosen file is gone when it held the only copy and that copy died', async () => {
    const durable = new InMemoryDurableCache();
    const probe = new ListedBlobReadabilityProbe();
    const cache = build(durable, probe);
    durable.refuseWrites = true;
    const picked = bytes('frames');
    await cache.store('a', picked).catch(() => undefined);

    probe.markGone(picked);

    expect(await cache.load('a')).toEqual({ outcome: 'missing', reason: 'held-file-gone' });
  });

  it('lets go of a held file the runtime refuses to read, not only one that is gone', async () => {
    const durable = new InMemoryDurableCache();
    const probe = new ListedBlobReadabilityProbe();
    const cache = build(durable, probe);
    const picked = bytes('frames');
    await durable.store('a', bytes('from disk'));
    durable.refuseWrites = true;
    await cache.store('a', picked).catch(() => undefined);

    // What a picked file becomes on iOS and iPadOS once the system has
    // removed the copy it handed the page: still a `Blob`, still the
    // right size, and every read fails as `NotReadableError`.
    probe.markUnreadable(picked);

    expect(await readBack(await cache.load('a'))).toBe('from disk');
  });

  it('falls back to the durable copy when the held file died but the bytes were kept', async () => {
    const durable = new InMemoryDurableCache();
    const probe = new ListedBlobReadabilityProbe();
    const cache = build(durable, probe);
    const picked = bytes('frames');
    await durable.store('a', bytes('frames'));
    durable.refuseWrites = true;
    await cache.store('a', picked).catch(() => undefined);

    probe.markGone(picked);

    expect(await cache.load('a')).toMatchObject({ outcome: 'found', source: 'device' });
  });

  it('forgets the project it holds when that project is deleted', async () => {
    const durable = new InMemoryDurableCache();
    const cache = build(durable);
    durable.refuseWrites = true;
    await cache.store('a', bytes('frames')).catch(() => undefined);

    await cache.delete('a');

    expect(await cache.load('a')).toEqual({ outcome: 'missing', reason: 'absent' });
  });
});
