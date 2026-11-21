/**
 * Declarative description of one object store on the shared IndexedDB
 * connection. Consumers declare their store's name and key path; the
 * connection-owning `IndexedDbClient` composes the list and ensures
 * every store exists. Dropping or renaming a store is an
 * `IndexedDbMigration`.
 *
 * The store definition is the only IndexedDB-shaped concern a feature
 * module exposes: data reads and writes go through `IndexedDbClient`
 * helpers or, for more involved transactions, through the database
 * handle the client returns from `open()`.
 */
export interface IndexedDbStoreDefinition {
  readonly name: string;
  readonly keyPath: string;
}
