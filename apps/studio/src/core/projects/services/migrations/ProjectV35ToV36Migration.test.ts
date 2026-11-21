import { describe, expect, it } from 'vitest';
import { ProjectV35ToV36Migration } from '@core/projects/services/migrations/ProjectV35ToV36Migration';
import { ShotPartition, type ShotsSnapshot } from '@core/shots/domain/ShotPartition';

/** A v35 project's layers each ended with their own shot; they still do. */

const migration = new ProjectV35ToV36Migration();

const V35_PROJECT: Record<string, unknown> = {
  version: 35,
  id: 'project',
  name: 'Talk',
  shots: {
    maxShotSec: 4,
    shots: [
      { id: 'a', startSec: 0, layers: [{ id: 'broll', mediaId: 'clip', inSec: 0, outSec: null, loop: false }] },
      { id: 'b', startSec: 4 },
    ],
  },
};

describe('a v35 project', () => {
  it('is carried as it was, in a payload of its own', () => {
    const migrated = migration.migrate(V35_PROJECT);

    expect(migrated).toEqual(V35_PROJECT);
    expect(migrated).not.toBe(V35_PROJECT);
  });

  it('keeps each layer on its own shot', () => {
    const shots = ShotPartition.fromSnapshot(migration.migrate(V35_PROJECT)['shots'] as ShotsSnapshot);

    expect(shots.runOf('broll').map((shot) => shot.id)).toEqual(['a']);
  });
});
