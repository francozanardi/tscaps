import { describe, expect, it } from 'vitest';
import { ProjectV36ToV37Migration } from '@core/projects/services/migrations/ProjectV36ToV37Migration';
import { ShotPartition, type ShotsSnapshot } from '@core/shots/domain/ShotPartition';

/** A v36 project followed no one; it still does not. */

const migration = new ProjectV36ToV37Migration();

const V36_PROJECT: Record<string, unknown> = {
  version: 36,
  id: 'project',
  name: 'Walk',
  shots: { maxShotSec: 4, shots: [{ id: 'a', startSec: 0 }, { id: 'b', startSec: 4 }] },
};

describe('a v36 project', () => {
  it('is carried as it was, in a payload of its own', () => {
    const migrated = migration.migrate(V36_PROJECT);

    expect(migrated).toEqual(V36_PROJECT);
    expect(migrated).not.toBe(V36_PROJECT);
  });

  it('has no shot following anyone', () => {
    const shots = ShotPartition.fromSnapshot(migration.migrate(V36_PROJECT)['shots'] as ShotsSnapshot);

    expect(shots.list().map((shot) => shot.follow)).toEqual([undefined, undefined]);
    expect(shots.hasStyledVideo()).toBe(false);
  });
});
