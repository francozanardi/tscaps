import type { IndexedDbMigration } from '@core/_shared/infrastructure/migrations/IndexedDbMigration';

const RETIRED_STORES = ['video-proxies-access', 'person-segmentation-cache-access'];

/**
 * The preview proxy and the mask cache stopped keeping an eviction
 * order of their own: they go with their project's video. The stores
 * that held their orders are dropped.
 */
export class IndexedDbV10ToV11Migration implements IndexedDbMigration {
  readonly fromVersion = 10;

  migrate(transaction: IDBTransaction): void {
    for (const store of RETIRED_STORES) {
      if (transaction.db.objectStoreNames.contains(store)) transaction.db.deleteObjectStore(store);
    }
  }
}
