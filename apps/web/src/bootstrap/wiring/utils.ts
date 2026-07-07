import { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { IndexedDbStoreDefinition } from '@core/_shared/infrastructure/IndexedDbStoreDefinition';
import { UserAgentInspector } from '@core/_shared/infrastructure/UserAgentInspector';
import { LocalStorageClient } from '@core/_shared/infrastructure/LocalStorageClient';
import { E2EMode } from '@core/_shared/infrastructure/E2EMode';

const INDEXED_DB_NAME = 'tscaps';
const INDEXED_DB_VERSION = 7;

export interface UtilsDependencies {
  /**
   * Every store any feature persists into the shared IndexedDB
   * database. Each feature wiring contributes its own definition
   * (with optional `onUpgrade` for per-version migrations); the
   * composition root collects them and hands them off here. Adding
   * or removing a store requires bumping `INDEXED_DB_VERSION`.
   */
  readonly indexedDbStores: readonly IndexedDbStoreDefinition[];
}

export type UtilsModule = ReturnType<typeof bootUtils>;

/**
 * Boots runtime utilities that are not tied to any feature module —
 * environment detection, the namespaced `localStorage` wrapper, the
 * shared IndexedDB connection, and similar cross-cutting helpers
 * consumers ask about without owning a domain of their own.
 */
export function bootUtils(deps: UtilsDependencies) {
  return {
    userAgentInspector: new UserAgentInspector(),
    localStorageClient: new LocalStorageClient('tscaps'),
    indexedDb: new IndexedDbClient({
      dbName: INDEXED_DB_NAME,
      dbVersion: INDEXED_DB_VERSION,
      stores: deps.indexedDbStores,
    }),
    e2eMode: new E2EMode(),
  };
}
