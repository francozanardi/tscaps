/**
 * One step of the IndexedDB schema, from `fromVersion` to
 * `fromVersion + 1`. Runs inside the upgrade transaction, after every
 * declared store exists.
 *
 * Only for what a declaration cannot say about the stores themselves:
 * dropping or renaming one. A new store needs its declaration and a
 * version bump, and no step here; a record whose shape changed is
 * read into the new one by its repository.
 */
export interface IndexedDbMigration {
  readonly fromVersion: number;
  migrate(transaction: IDBTransaction): void;
}
