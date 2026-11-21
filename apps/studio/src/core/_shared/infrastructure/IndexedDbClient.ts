import type { IndexedDbStoreDefinition } from '@core/_shared/infrastructure/IndexedDbStoreDefinition';
import { IndexedDbSupersededError } from '@core/_shared/infrastructure/IndexedDbSupersededError';
import type { IndexedDbMigrator } from '@core/_shared/infrastructure/migrations/IndexedDbMigrator';

/**
 * Thrown when opening the database is blocked by another connection
 * held open by a different tab (typically running an older version
 * of the app that predates a schema bump). The upgrade cannot proceed
 * until that tab closes.
 */
export class IndexedDbBlockedError extends Error {
  constructor(dbName: string, targetVersion: number) {
    super(
      `IndexedDB "${dbName}" upgrade to version ${targetVersion} is blocked by another open connection. ` +
      `Close other tabs of this app and reload.`,
    );
    this.name = 'IndexedDbBlockedError';
  }
}

/**
 * How a page found out that its code is older than the database: a
 * newer version of the app upgraded the database while this page held
 * it open, or the database was already newer than this page's code
 * when the page asked for it.
 */
export type OutdatedPageTrigger = 'upgraded-while-open' | 'newer-on-open';

export interface IndexedDbClientConfig {
  readonly dbName: string;
  readonly dbVersion: number;
  readonly stores: readonly IndexedDbStoreDefinition[];
  /** The schema steps an older database takes on its way to `dbVersion`. */
  readonly migrator: IndexedDbMigrator;
}

/**
 * Generic owner of a single IndexedDB connection. Knows nothing about
 * the data stored inside — store shapes come from each feature's
 * `IndexedDbStoreDefinition`, and the steps an older database takes
 * from the `IndexedDbMigrator`.
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
 *
 * A failed open drops the memoised promise so the next call retries
 * with a fresh request. If another tab holds an older version open
 * the browser dispatches `blocked` on the upgrade request — surfaced
 * here as a rejection with a diagnostic message instead of an
 * indefinite hang. Symmetrically, the accepted connection listens
 * for `versionchange` and closes itself so a sibling tab can upgrade
 * without being blocked by this one.
 *
 * Letting a newer version upgrade leaves this page's code older than
 * the database, and so does finding the database already upgraded
 * when the page first asks for it. Neither is retried: from then on
 * every request rejects at once with `IndexedDbSupersededError`, and
 * `onPageOutdated` tells whoever has to ask the reader to reload,
 * once. Only a new page load clears it.
 *
 * A connection the browser closes on its own is forgotten the same
 * way. WebKit drops every open connection when the process hosting
 * its database server goes away — a page suspended in the background
 * on iOS comes back to exactly that — and dispatches `close` on each.
 * Keeping such a connection memoised would fail every request for the
 * rest of the session; forgetting it lets the next one reopen.
 */
export class IndexedDbClient {
  private connection: Promise<IDBDatabase> | null = null;
  private outdatedBy: OutdatedPageTrigger | null = null;
  private readonly outdatedListeners = new Set<(trigger: OutdatedPageTrigger) => void>();

  constructor(private readonly config: IndexedDbClientConfig) {}

  open(): Promise<IDBDatabase> {
    if (this.outdatedBy) return Promise.reject(this.supersededError());
    if (!this.connection) this.connection = this.startConnectionAttempt();
    return this.connection;
  }

  /**
   * How this page found out that its code is older than the database,
   * or `null` while it has not. Once set, it stays set.
   */
  outdatedPageTrigger(): OutdatedPageTrigger | null {
    return this.outdatedBy;
  }

  /**
   * Calls `listener` once, when this page finds out that its code is
   * older than the database. A listener added after that is never
   * called, so read `outdatedPageTrigger()` too. Returns the
   * unsubscribe function.
   */
  onPageOutdated(listener: (trigger: OutdatedPageTrigger) => void): () => void {
    this.outdatedListeners.add(listener);
    return () => {
      this.outdatedListeners.delete(listener);
    };
  }

  private startConnectionAttempt(): Promise<IDBDatabase> {
    const attempt = this.openConnection();
    attempt.catch(() => this.forgetFailedAttempt(attempt));
    return attempt;
  }

  private forgetFailedAttempt(attempt: Promise<IDBDatabase>): void {
    if (this.connection === attempt) this.connection = null;
  }

  readAll<T>(storeName: string): Promise<T[]> {
    return this.readRequest<T[]>(storeName, (store) => store.getAll());
  }

  /** The keys in a store, without materialising any of its records. */
  readAllKeys(storeName: string): Promise<IDBValidKey[]> {
    return this.readRequest<IDBValidKey[]>(storeName, (store) => store.getAllKeys());
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
      const transaction = this.beginTransaction(db, storeName, 'readonly');
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
      const transaction = this.beginTransaction(db, storeName, 'readwrite');
      const req = request(transaction.objectStore(storeName));
      req.onerror = () => reject(req.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    });
  }

  /**
   * A request that already held the connection when a newer version
   * took it fails the way every later request does, rather than with
   * the browser's message about a closing connection.
   */
  private beginTransaction(db: IDBDatabase, storeName: string, mode: IDBTransactionMode): IDBTransaction {
    try {
      return db.transaction(storeName, mode);
    } catch (error) {
      if (this.outdatedBy) throw this.supersededError(error);
      throw error;
    }
  }

  private openConnection(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.config.dbName, this.config.dbVersion);
      req.onupgradeneeded = (event) => this.runUpgrade(req, event);
      req.onsuccess = () => this.acceptConnectionOrReject(req.result, resolve, reject);
      req.onerror = () => {
        if (this.isRefusedAsOlderThanStored(req.error)) this.markPageOutdated('newer-on-open');
        reject(this.outdatedBy ? this.supersededError(req.error) : req.error);
      };
      req.onblocked = () => reject(new IndexedDbBlockedError(this.config.dbName, this.config.dbVersion));
    });
  }

  /** The browser refuses to open a database at a lower version than the one stored, and names that refusal `VersionError`. */
  private isRefusedAsOlderThanStored(error: DOMException | null): boolean {
    return error?.name === 'VersionError';
  }

  private acceptConnectionOrReject(
    db: IDBDatabase,
    resolve: (db: IDBDatabase) => void,
    reject: (error: Error) => void,
  ): void {
    const missing = this.missingDeclaredStores(db);
    if (missing.length > 0) {
      db.close();
      reject(this.buildMissingStoresError(missing));
      return;
    }
    this.releaseConnectionWhenAnotherTabUpgrades(db);
    this.forgetConnectionWhenTheBrowserClosesIt(db);
    resolve(db);
  }

  private releaseConnectionWhenAnotherTabUpgrades(db: IDBDatabase): void {
    db.onversionchange = (event) => {
      db.close();
      if (this.connection) this.connection = null;
      if (this.isUpgradePastKnownVersion(event)) this.markPageOutdated('upgraded-while-open');
    };
  }

  /** A deletion announces no new version, and leaves nothing this page's code is too old for. */
  private isUpgradePastKnownVersion(event: IDBVersionChangeEvent): boolean {
    return event.newVersion !== null && event.newVersion > this.config.dbVersion;
  }

  private markPageOutdated(trigger: OutdatedPageTrigger): void {
    if (this.outdatedBy) return;
    this.outdatedBy = trigger;
    for (const listener of [...this.outdatedListeners]) listener(trigger);
  }

  private supersededError(cause?: unknown): IndexedDbSupersededError {
    const options = cause === undefined ? undefined : { cause };
    return new IndexedDbSupersededError(this.config.dbName, this.config.dbVersion, options);
  }

  private forgetConnectionWhenTheBrowserClosesIt(db: IDBDatabase): void {
    db.onclose = () => {
      if (this.connection) this.connection = null;
    };
  }

  private buildMissingStoresError(missing: string[]): Error {
    return new Error(
      `IndexedDB "${this.config.dbName}" at version ${this.config.dbVersion} is missing declared store(s): ${missing.join(', ')}. ` +
      `Bump the IndexedDB version so the upgrade transaction creates them.`,
    );
  }

  private missingDeclaredStores(db: IDBDatabase): string[] {
    return this.config.stores
      .map((store) => store.name)
      .filter((name) => !db.objectStoreNames.contains(name));
  }

  private runUpgrade(request: IDBOpenDBRequest, event: IDBVersionChangeEvent): void {
    this.ensureStoresExist(request.result);
    if (!request.transaction) return;
    this.config.migrator.run(request.transaction, event.oldVersion);
  }

  private ensureStoresExist(db: IDBDatabase): void {
    for (const store of this.config.stores) {
      if (db.objectStoreNames.contains(store.name)) continue;
      db.createObjectStore(store.name, { keyPath: store.keyPath });
    }
  }

}
