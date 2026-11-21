import { describe, expect, it } from 'vitest';
import type { IndexedDbMigration } from '@core/_shared/infrastructure/migrations/IndexedDbMigration';
import { IndexedDbMigrator } from '@core/_shared/infrastructure/migrations/IndexedDbMigrator';

/**
 * An older database takes exactly the steps it has not taken, oldest
 * first. A new one takes none: it is built at the current shape. And a
 * step that could never run is refused before any database is opened,
 * since the reader would otherwise carry the old shape forever.
 */

const TRANSACTION = {} as IDBTransaction;

function recordingSteps(fromVersions: number[], ran: number[]): IndexedDbMigration[] {
  return fromVersions.map((fromVersion) => ({ fromVersion, migrate: () => { ran.push(fromVersion); } }));
}

describe('IndexedDbMigrator', () => {
  it('runs the steps an older database has not taken, oldest first', () => {
    const ran: number[] = [];

    new IndexedDbMigrator(recordingSteps([12, 10, 11], ran), 13).run(TRANSACTION, 11);

    expect(ran).toEqual([11, 12]);
  });

  it('runs nothing on a database created from nothing', () => {
    const ran: number[] = [];

    new IndexedDbMigrator(recordingSteps([10], ran), 11).run(TRANSACTION, 0);

    expect(ran).toEqual([]);
  });

  it('refuses a step written without bumping the version', () => {
    expect(() => new IndexedDbMigrator(recordingSteps([11], []), 11)).toThrow(/never run/);
  });

  it('refuses two steps from the same version', () => {
    expect(() => new IndexedDbMigrator(recordingSteps([10, 10], []), 11)).toThrow(/Two/);
  });
});
