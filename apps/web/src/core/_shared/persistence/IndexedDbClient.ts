import type { IndexedDbStoreDefinition } from '@core/_shared/persistence/IndexedDbStoreDefinition';

export interface IndexedDbClientConfig {
  readonly dbName: string;
  readonly dbVersion: number;
  readonly stores: readonly IndexedDbStoreDefinition[];
}

/**
 * Generic owner of a single IndexedDB connection. Knows nothing about
 * the data stored inside — store shapes and per-version migrations
 * are supplied by the consuming features via `IndexedDbStoreDefinition`.
 *
 * One instance per database. Sharing the connection across consumers
 * matters: separate connections opened at the same version race each
 * other's `onupgradeneeded` callback and a feature that didn't run
 * its setup would silently miss its store.
 *
 * Write helpers (`writeOne`, `deleteOne`) resolve on the transaction's
 * `oncomplete` event so the next read in a separate transaction is
 * guaranteed to observe the committed value. A request's `onsuccess`
 * fires earlier, when the operation is only queued.
 *
 * Transactions that span multiple requests use `open()` directly to
 * grab the raw `IDBDatabase`.
 */
export class IndexedDbClient {
  private connection: Promise<IDBDatabase> | null = null;

  constructor(private readonly config: IndexedDbClientConfig) {}

  open(): Promise<IDBDatabase> {
    if (!this.connection) this.connection = this.openConnection();
    return this.connection;
  }

  readAll<T>(storeName: string): Promise<T[]> {
    return this.readRequest<T[]>(storeName, (store) => store.getAll());
  }

  async readOne<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
    const result = await this.readRequest<T | undefined>(storeName, (store) => store.get(key));
    return result ?? null;
  }

  writeOne(storeName: string, value: object): Promise<void> {
    return this.commitWrite(storeName, (store) => store.put(value));
  }

  deleteOne(storeName: string, key: IDBValidKey): Promise<void> {
    return this.commitWrite(storeName, (store) => store.delete(key));
  }

  private async readRequest<T>(
    storeName: string,
    request: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const req = request(transaction.objectStore(storeName));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    });
  }

  private async commitWrite(
    storeName: string,
    request: (store: IDBObjectStore) => IDBRequest,
  ): Promise<void> {
    const db = await this.open();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const req = request(transaction.objectStore(storeName));
      req.onerror = () => reject(req.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    });
  }

  private openConnection(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.config.dbName, this.config.dbVersion);
      req.onupgradeneeded = (event) => this.runUpgrade(req, event);
      req.onsuccess = () => this.acceptConnectionOrReject(req.result, resolve, reject);
      req.onerror = () => reject(req.error);
    });
  }

  private acceptConnectionOrReject(
    db: IDBDatabase,
    resolve: (db: IDBDatabase) => void,
    reject: (error: Error) => void,
  ): void {
    const missing = this.missingDeclaredStores(db);
    if (missing.length === 0) {
      resolve(db);
      return;
    }
    db.close();
    reject(new Error(
      `IndexedDB "${this.config.dbName}" at version ${this.config.dbVersion} is missing declared store(s): ${missing.join(', ')}. ` +
      `Bump the IndexedDB version so the upgrade transaction creates them.`,
    ));
  }

  private missingDeclaredStores(db: IDBDatabase): string[] {
    return this.config.stores
      .map((store) => store.name)
      .filter((name) => !db.objectStoreNames.contains(name));
  }

  private runUpgrade(request: IDBOpenDBRequest, event: IDBVersionChangeEvent): void {
    this.ensureStoresExist(request.result);
    if (!request.transaction) return;
    this.runStoreUpgrades(request.transaction, event.oldVersion, event.newVersion ?? this.config.dbVersion);
  }

  private ensureStoresExist(db: IDBDatabase): void {
    for (const store of this.config.stores) {
      if (db.objectStoreNames.contains(store.name)) continue;
      db.createObjectStore(store.name, { keyPath: store.keyPath });
    }
  }

  private runStoreUpgrades(
    transaction: IDBTransaction,
    oldVersion: number,
    newVersion: number,
  ): void {
    for (const store of this.config.stores) {
      if (!store.onUpgrade) continue;
      store.onUpgrade({ transaction, oldVersion, newVersion });
    }
  }
}
