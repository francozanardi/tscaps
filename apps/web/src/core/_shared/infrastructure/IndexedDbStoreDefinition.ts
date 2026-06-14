/**
 * Context passed to a store's `onUpgrade` callback when the IndexedDB
 * version bumps. Carries the in-flight upgrade transaction (the only
 * place new object stores or per-record migrations can run) plus the
 * version range the consumer is upgrading across.
 */
export interface IndexedDbStoreUpgradeContext {
  readonly transaction: IDBTransaction;
  readonly oldVersion: number;
  readonly newVersion: number;
}

/**
 * Declarative description of one object store on the shared IndexedDB
 * connection. Consumers declare their store's name, key path, and an
 * optional per-version upgrade hook; the connection-owning
 * `IndexedDbClient` composes the list, ensures every store exists,
 * and runs each `onUpgrade` once when the database bumps version.
 *
 * The store definition is the only IndexedDB-shaped concern a feature
 * module exposes: data reads and writes go through `IndexedDbClient`
 * helpers or, for more involved transactions, through the database
 * handle the client returns from `open()`.
 */
export interface IndexedDbStoreDefinition {
  readonly name: string;
  readonly keyPath: string;
  readonly onUpgrade?: (context: IndexedDbStoreUpgradeContext) => void;
}
