import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';

/**
 * In-memory stand-in for the shared database, one map per store, each
 * keyed by the key path its store declares. A second repository built
 * over the same instance reads what the first wrote, which is what a
 * reload does to the real one.
 */
export class FakeIndexedDbClient {
  private readonly stores = new Map<string, Map<string, object>>();

  constructor(private readonly keyPaths: Readonly<Record<string, string>>) {}

  /** This fake, typed as the client the repositories take. */
  asClient(): IndexedDbClient {
    return this as unknown as IndexedDbClient;
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
    const key = (value as Record<string, unknown>)[this.keyPathOf(storeName)];
    this.records(storeName).set(String(key), value);
    return Promise.resolve();
  }

  deleteOne(storeName: string, key: IDBValidKey): Promise<void> {
    this.records(storeName).delete(String(key));
    return Promise.resolve();
  }

  private keyPathOf(storeName: string): string {
    const keyPath = this.keyPaths[storeName];
    if (!keyPath) throw new Error(`No store named ${storeName}`);
    return keyPath;
  }

  private records(storeName: string): Map<string, object> {
    this.keyPathOf(storeName);
    let records = this.stores.get(storeName);
    if (!records) {
      records = new Map();
      this.stores.set(storeName, records);
    }
    return records;
  }
}
