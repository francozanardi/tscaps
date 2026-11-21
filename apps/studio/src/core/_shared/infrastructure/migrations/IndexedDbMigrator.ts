import type { IndexedDbMigration } from '@core/_shared/infrastructure/migrations/IndexedDbMigration';

/**
 * Runs the IndexedDB schema steps a database has not taken yet, oldest
 * first, when it is upgraded to `targetVersion`.
 *
 * A database created from nothing is built at the current shape from
 * the store declarations, so it takes no step: there is nothing old in
 * it to move.
 *
 * Refuses a set of steps that could not all run — two claiming the
 * same version, or one starting at or past `targetVersion`, which is a
 * step written without bumping the version and would never run.
 */
export class IndexedDbMigrator {
  private readonly steps: readonly IndexedDbMigration[];

  constructor(steps: readonly IndexedDbMigration[], private readonly targetVersion: number) {
    this.steps = [...steps].sort((a, b) => a.fromVersion - b.fromVersion);
    this.assertAllCanRun();
  }

  run(transaction: IDBTransaction, oldVersion: number): void {
    if (oldVersion === 0) return;
    for (const step of this.steps) {
      if (step.fromVersion >= oldVersion) step.migrate(transaction);
    }
  }

  private assertAllCanRun(): void {
    const seen = new Set<number>();
    for (const step of this.steps) {
      if (seen.has(step.fromVersion)) {
        throw new Error(`Two IndexedDB migrations start at version ${step.fromVersion}.`);
      }
      seen.add(step.fromVersion);
      if (step.fromVersion >= this.targetVersion) {
        throw new Error(
          `The IndexedDB migration from version ${step.fromVersion} would never run: `
          + `the database is at version ${this.targetVersion}. Bump the version with it.`,
        );
      }
    }
  }
}
