import type { IndexedDbMigration } from '@core/_shared/infrastructure/migrations/IndexedDbMigration';

const RETIRED_STORES = ['project-media', 'project-media-proxies'];

/**
 * A project's files became the user's media assets, kept by asset in
 * stores of their own, with an owner that may be the library. The
 * stores that held them by project are dropped.
 */
export class IndexedDbV12ToV13Migration implements IndexedDbMigration {
  readonly fromVersion = 12;

  migrate(transaction: IDBTransaction): void {
    for (const store of RETIRED_STORES) {
      if (transaction.db.objectStoreNames.contains(store)) transaction.db.deleteObjectStore(store);
    }
  }
}
