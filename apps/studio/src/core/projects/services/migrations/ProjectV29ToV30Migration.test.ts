import { describe, expect, it } from 'vitest';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotsSnapshot } from '@core/shots/domain/ShotPartition';
import { ProjectV29ToV30Migration } from '@core/projects/services/migrations/ProjectV29ToV30Migration';

/**
 * A v29 project's shots hold files only. The promise is that it opens
 * exactly as it was: the step exists so that a build still on v29, which
 * drops a layer naming no file, refuses a v30 project rather than saving
 * it without its graphics.
 */

const migration = new ProjectV29ToV30Migration();

const V29_PROJECT: Record<string, unknown> = {
  version: 29,
  id: 'project',
  name: 'Talk',
  shots: {
    maxShotSec: 4,
    shots: [{ id: 'shot-1', startSec: 0, layers: [{ id: 'layer-1', mediaId: 'broll', inSec: 1, outSec: null, loop: true }] }],
  },
};

describe('a v29 project', () => {
  it('is carried as it was, in a payload of its own', () => {
    const migrated = migration.migrate(V29_PROJECT);

    expect(migrated).toEqual(V29_PROJECT);
    expect(migrated).not.toBe(V29_PROJECT);
  });

  it('reads its file layers as they were', () => {
    const shots = ShotPartition.fromSnapshot(migration.migrate(V29_PROJECT)['shots'] as ShotsSnapshot);

    expect(shots.findLayer('layer-1')).toEqual({ id: 'layer-1', mediaId: 'broll', inSec: 1, outSec: null, loop: true });
  });
});
