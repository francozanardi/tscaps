import { describe, expect, it } from 'vitest';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotsSnapshot } from '@core/shots/domain/ShotPartition';
import { ProjectV31ToV32Migration } from '@core/projects/services/migrations/ProjectV31ToV32Migration';

/** A v31 graphic kept no preset; it opens as it was, reading as one that names none. */

const migration = new ProjectV31ToV32Migration();

const V31_PROJECT: Record<string, unknown> = {
  version: 31,
  id: 'project',
  name: 'Talk',
  shots: {
    maxShotSec: 4,
    shots: [{
      id: 'shot-1',
      startSec: 0,
      layers: [{ id: 'layer-1', graphic: { document: { html: '<p>Hi</p>', css: '', js: '' }, fields: [], params: {}, aspectRatio: 4, moments: [] } }],
    }],
  },
};

describe('a v31 project', () => {
  it('is carried as it was, in a payload of its own', () => {
    const migrated = migration.migrate(V31_PROJECT);

    expect(migrated).toEqual(V31_PROJECT);
    expect(migrated).not.toBe(V31_PROJECT);
  });

  it('reads its graphics as naming no preset', () => {
    const shots = ShotPartition.fromSnapshot(migration.migrate(V31_PROJECT)['shots'] as ShotsSnapshot);

    expect(shots.findLayer('layer-1')).toEqual({
      id: 'layer-1',
      graphic: { document: { html: '<p>Hi</p>', css: '', js: '' }, fields: [], params: {}, aspectRatio: 4, moments: [], presetId: null, hidesCaptions: false },
    });
  });
});
