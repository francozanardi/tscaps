import { describe, expect, it } from 'vitest';
import { ShotPartition, type ShotsSnapshot } from '@core/shots/domain/ShotPartition';
import { ProjectV25ToV26Migration } from '@core/projects/services/migrations/ProjectV25ToV26Migration';

/**
 * A v25 project has no transitions between its shots. The promise is
 * that it opens exactly as it was, every cut a plain one: the step
 * exists so that a build still on v25 refuses a v26 project rather
 * than saving it without its transitions.
 */

const migration = new ProjectV25ToV26Migration();

const V25_PROJECT: Record<string, unknown> = {
  version: 25,
  id: 'project',
  name: 'Talk',
  shots: { maxShotSec: 4, shots: [{ id: 'a', startSec: 0 }, { id: 'b', startSec: 2 }] },
};

describe('a v25 project', () => {
  it('is carried as it was, in a payload of its own', () => {
    const migrated = migration.migrate(V25_PROJECT);

    expect(migrated).toEqual(V25_PROJECT);
    expect(migrated).not.toBe(V25_PROJECT);
  });

  it('reads with every cut a plain one', () => {
    const shots = ShotPartition.fromSnapshot(migration.migrate(V25_PROJECT)['shots'] as ShotsSnapshot);

    expect(shots.list().map((shot) => shot.transition)).toEqual([undefined, undefined]);
  });
});
