import { describe, expect, it } from 'vitest';
import type { BlobReadability, BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import { IndexedDbVideoBlobCache } from '@core/videos/infrastructure/IndexedDbVideoBlobCache';

/**
 * Two promises, and the second is the one worth pinning: bytes that
 * will not read are a miss either way, but only a file that is *gone*
 * costs the project its entry. A read the runtime merely refused may
 * go through next time, and dropping the record on it would turn a
 * bad moment into a video nobody can get back.
 */

const STORE = 'videos';

interface Keyed {
  readonly projectId: string;
}

/** In-memory stand-in for the shared database, one map per store. */
class FakeIndexedDbClient {
  private readonly stores = new Map<string, Map<string, Keyed>>();

  keys(storeName: string): string[] {
    return [...this.records(storeName).keys()];
  }

  readOne<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
    return Promise.resolve((this.records(storeName).get(String(key)) as T | undefined) ?? null);
  }

  readAll<T>(storeName: string): Promise<T[]> {
    return Promise.resolve([...this.records(storeName).values()] as T[]);
  }

  readAllKeys(storeName: string): Promise<IDBValidKey[]> {
    return Promise.resolve([...this.records(storeName).keys()]);
  }

  writeOne(storeName: string, value: object): Promise<void> {
    const record = value as Keyed;
    this.records(storeName).set(record.projectId, record);
    return Promise.resolve();
  }

  deleteOne(storeName: string, key: IDBValidKey): Promise<void> {
    this.records(storeName).delete(String(key));
    return Promise.resolve();
  }

  private records(storeName: string): Map<string, Keyed> {
    let records = this.stores.get(storeName);
    if (!records) {
      records = new Map();
      this.stores.set(storeName, records);
    }
    return records;
  }
}

class FixedProbe implements BlobReadabilityProbe {
  constructor(private readonly readability: BlobReadability) {}

  probe(): Promise<BlobReadability> {
    return Promise.resolve(this.readability);
  }
}

const substitute = <T>(stub: object): T => stub as T;

async function cacheHolding(readability: BlobReadability) {
  const db = new FakeIndexedDbClient();
  const cache = new IndexedDbVideoBlobCache(substitute<IndexedDbClient>(db), new FixedProbe(readability), 3);
  await cache.store('a', new Blob(['frames']));
  return { db, cache };
}

describe('IndexedDbVideoBlobCache', () => {

  it('hands back the bytes it holds', async () => {
    const { cache } = await cacheHolding('readable');

    expect(await cache.load('a')).toMatchObject({ outcome: 'found', source: 'device' });
  });

  it('drops the entry when the file behind it is gone, so the slot stops being wasted', async () => {
    const { db, cache } = await cacheHolding('gone');

    expect(await cache.load('a')).toEqual({ outcome: 'missing', reason: 'stored-bytes-gone' });
    expect(db.keys(STORE)).toEqual([]);
  });

  it('keeps the entry when the read was only refused, and still reports a miss', async () => {
    const { db, cache } = await cacheHolding('unreadable');

    expect(await cache.load('a')).toEqual({ outcome: 'missing', reason: 'stored-bytes-gone' });
    expect(db.keys(STORE)).toEqual(['a']);
  });
});
