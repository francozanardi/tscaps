import { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { IndexedDbStoreDefinition } from '@core/_shared/infrastructure/IndexedDbStoreDefinition';
import type { IndexedDbMigration } from '@core/_shared/infrastructure/migrations/IndexedDbMigration';
import { IndexedDbMigrator } from '@core/_shared/infrastructure/migrations/IndexedDbMigrator';
import { UserAgentInspector } from '@shared/browser';
import { LocalStorageClient } from '@core/_shared/infrastructure/LocalStorageClient';
import { TabAutomationSession } from '@core/automation/infrastructure/TabAutomationSession';
import { E2EMode } from '@core/_shared/infrastructure/E2EMode';
import { StorageFootprintProbe } from '@core/_shared/infrastructure/StorageFootprintProbe';
import { StoragePersistence } from '@core/_shared/infrastructure/StoragePersistence';
import { AnchorFileDownloader } from '@core/_shared/infrastructure/AnchorFileDownloader';
import { SliceReadBlobReadabilityProbe } from '@core/_shared/infrastructure/SliceReadBlobReadabilityProbe';

const INDEXED_DB_NAME = 'tscaps';
const INDEXED_DB_VERSION = 14;

export interface UtilsDependencies {
  /**
   * Every store any feature persists into the shared IndexedDB
   * database. Each feature wiring contributes its own definition; the
   * composition root collects them and hands them off here. Adding or
   * removing a store requires bumping `INDEXED_DB_VERSION`.
   */
  readonly indexedDbStores: readonly IndexedDbStoreDefinition[];
  /** The schema steps an older database takes, one per version that needed more than a declaration. */
  readonly indexedDbMigrations: readonly IndexedDbMigration[];
}

export type UtilsModule = ReturnType<typeof bootUtils>;

/**
 * Boots runtime utilities that are not tied to any feature module —
 * environment detection, the namespaced `localStorage` wrapper, the
 * shared IndexedDB connection, and similar cross-cutting helpers
 * consumers ask about without owning a domain of their own.
 */
export function bootUtils(deps: UtilsDependencies) {
  const storagePersistence = new StoragePersistence();
  return {
    storagePersistence,
    userAgentInspector: new UserAgentInspector(),
    localStorageClient: new LocalStorageClient('tscaps'),
    indexedDb: new IndexedDbClient({
      dbName: INDEXED_DB_NAME,
      dbVersion: INDEXED_DB_VERSION,
      stores: deps.indexedDbStores,
      migrator: new IndexedDbMigrator(deps.indexedDbMigrations, INDEXED_DB_VERSION),
    }),
    e2eMode: new E2EMode(),
    automationSession: new TabAutomationSession(),
    storageFootprintProbe: new StorageFootprintProbe(storagePersistence),
    fileDownloader: new AnchorFileDownloader(),
    blobReadabilityProbe: new SliceReadBlobReadabilityProbe(),
  };
}
