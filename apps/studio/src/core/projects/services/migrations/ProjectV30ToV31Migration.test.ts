import { describe, expect, it } from 'vitest';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotsSnapshot } from '@core/shots/domain/ShotPartition';
import { ProjectV30ToV31Migration } from '@core/projects/services/migrations/ProjectV30ToV31Migration';

/**
 * A v30 graphic declared no moments. The promise is that it opens exactly
 * as it was, reading as a graphic with none.
 */

const migration = new ProjectV30ToV31Migration();

const V30_PROJECT: Record<string, unknown> = {
  version: 30,
  id: 'project',
  name: 'Talk',
  shots: {
    maxShotSec: 4,
    shots: [{
      id: 'shot-1',
      startSec: 0,
      layers: [{ id: 'layer-1', graphic: { document: { html: '<p>Hi</p>', css: '', js: '' }, fields: [], params: {}, aspectRatio: 4 } }],
    }],
  },
};

describe('a v30 project', () => {
  it('is carried as it was, in a payload of its own', () => {
    const migrated = migration.migrate(V30_PROJECT);

    expect(migrated).toEqual(V30_PROJECT);
    expect(migrated).not.toBe(V30_PROJECT);
  });

  it('reads its graphics as having no moments', () => {
    const shots = ShotPartition.fromSnapshot(migration.migrate(V30_PROJECT)['shots'] as ShotsSnapshot);

    expect(shots.findLayer('layer-1')).toEqual({
      id: 'layer-1',
      graphic: { document: { html: '<p>Hi</p>', css: '', js: '' }, fields: [], params: {}, aspectRatio: 4, moments: [], presetId: null, hidesCaptions: false },
    });
  });
});
