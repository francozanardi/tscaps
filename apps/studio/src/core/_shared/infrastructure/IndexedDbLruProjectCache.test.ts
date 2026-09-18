import { describe, expect, it } from 'vitest';
import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import {
  IndexedDbLruProjectCache,
  type ProjectCacheEntry,
} from '@core/_shared/infrastructure/IndexedDbLruProjectCache';

/**
 * These cover the two promises the cache makes to whoever keeps a
 * per-project entry in it: what comes back out, and which project
 * loses its entry when the cap is reached. The entry shape below
 * stands in for a video blob, a preview proxy, or a mask cache — the
 * cache treats all three the same way.
 */

const STORE = 'entries';
const ACCESS_STORE = 'entries-access';

interface TestEntry extends ProjectCacheEntry {
  readonly payload: string;
}

interface Keyed {
  readonly projectId: string;
}

interface TestAccessRecord extends Keyed {
  readonly lastAccessed: number;
}

/**
 * In-memory stand-in for the database, one map per store name.
 * `refuseWrites` reproduces an origin with no room left: every write
 * raises, exactly as IndexedDB does once the quota is reached, while
 * reads keep working.
 */
class FakeIndexedDbClient {
  private readonly stores = new Map<string, Map<string, Keyed>>();

  refuseWrites = false;

  seed(payload: TestEntry, lastAccessed?: number): void {
    this.records(STORE).set(payload.projectId, payload);
    if (lastAccessed !== undefined) {
      const access: TestAccessRecord = { projectId: payload.projectId, lastAccessed };
      this.records(ACCESS_STORE).set(payload.projectId, access);
    }
  }

  keys(): string[] {
    return [...this.records(STORE).keys()];
  }

  storedEntry(projectId: string): Keyed | undefined {
    return this.records(STORE).get(projectId);
  }

  accessKeys(): string[] {
    return [...this.records(ACCESS_STORE).keys()];
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
    if (this.refuseWrites) {
      return Promise.reject(new DOMException('The quota has been exceeded.', 'QuotaExceededError'));
    }
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

describe('IndexedDbLruProjectCache', () => {
  const substitute = <T>(stub: object): T => stub as T;

  const buildCache = (db: FakeIndexedDbClient, maxCachedProjects = 3) =>
    new IndexedDbLruProjectCache<TestEntry>(substitute<IndexedDbClient>(db), STORE, ACCESS_STORE, maxCachedProjects);

  it('reads the entry back when the origin has no room left to record the read', async () => {
    const db = new FakeIndexedDbClient();
    db.seed({ projectId: 'a', payload: 'bytes' }, 1);
    db.refuseWrites = true;

    const record = await buildCache(db).read('a');

    expect(record?.payload).toBe('bytes');
  });

  it('resolves to null for a project it holds nothing for', async () => {
    const db = new FakeIndexedDbClient();

    expect(await buildCache(db).read('missing')).toBeNull();
  });

  it('evicts the entry whose access time is the oldest', async () => {
    const db = new FakeIndexedDbClient();
    db.seed({ projectId: 'old', payload: 'old' }, 1);
    db.seed({ projectId: 'recent', payload: 'recent' }, 2);

    await buildCache(db, 2).write('incoming', { payload: 'incoming' });

    expect(db.keys().sort()).toEqual(['incoming', 'recent']);
  });

  it('spares the oldest entry once it has been read again', async () => {
    const db = new FakeIndexedDbClient();
    db.seed({ projectId: 'old', payload: 'old' }, 1);
    db.seed({ projectId: 'recent', payload: 'recent' }, 2);
    const store = buildCache(db, 2);

    await store.read('old');
    await store.write('incoming', { payload: 'incoming' });

    expect(db.keys().sort()).toEqual(['incoming', 'old']);
  });

  it('keeps every other project when one of them refreshes its own entry', async () => {
    const db = new FakeIndexedDbClient();
    db.seed({ projectId: 'a', payload: 'a' }, 1);
    db.seed({ projectId: 'b', payload: 'b' }, 2);

    await buildCache(db, 2).write('a', { payload: 'a2' });

    expect(db.keys().sort()).toEqual(['a', 'b']);
  });

  it('raises when the entry itself cannot be written', async () => {
    const db = new FakeIndexedDbClient();
    db.refuseWrites = true;

    await expect(buildCache(db).write('a', { payload: 'a' })).rejects.toThrow();
  });

  it('evicts first the entry whose read was never recorded', async () => {
    const db = new FakeIndexedDbClient();
    db.seed({ projectId: 'unrecorded', payload: 'unrecorded' });
    db.seed({ projectId: 'old', payload: 'old' }, 1);

    await buildCache(db, 2).write('incoming', { payload: 'incoming' });

    expect(db.keys().sort()).toEqual(['incoming', 'old']);
  });

  it('records a read without rewriting the entry it read', async () => {
    const db = new FakeIndexedDbClient();
    const seeded: TestEntry = { projectId: 'a', payload: 'bytes' };
    db.seed(seeded);

    await buildCache(db).read('a');

    expect(db.storedEntry('a')).toBe(seeded);
    expect(db.accessKeys()).toEqual(['a']);
  });

  it('forgets the access time along with the entry', async () => {
    const db = new FakeIndexedDbClient();
    db.seed({ projectId: 'a', payload: 'a' }, 1);

    await buildCache(db).delete('a');

    expect(db.keys()).toEqual([]);
    expect(db.accessKeys()).toEqual([]);
  });
});
