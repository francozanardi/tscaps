import { describe, expect, it } from 'vitest';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotsSnapshot } from '@core/shots/domain/ShotPartition';
import { ProjectV32ToV33Migration } from '@core/projects/services/migrations/ProjectV32ToV33Migration';

/** A v32 graphic kept the captions on; it opens as it was, reading as one that does not hide them. */

const migration = new ProjectV32ToV33Migration();

const V32_PROJECT: Record<string, unknown> = {
  version: 32,
  id: 'project',
  name: 'Talk',
  shots: {
    maxShotSec: 4,
    shots: [{
      id: 'shot-1',
      startSec: 0,
      layers: [{ id: 'layer-1', graphic: { document: { html: '<p>Hi</p>', css: '', js: '' }, fields: [], params: {}, aspectRatio: 4, moments: [], presetId: 'lower-third' } }],
    }],
  },
};

describe('a v32 project', () => {
  it('is carried as it was, in a payload of its own', () => {
    const migrated = migration.migrate(V32_PROJECT);

    expect(migrated).toEqual(V32_PROJECT);
    expect(migrated).not.toBe(V32_PROJECT);
  });

  it('reads its graphics as keeping the captions on', () => {
    const shots = ShotPartition.fromSnapshot(migration.migrate(V32_PROJECT)['shots'] as ShotsSnapshot);

    expect(shots.findLayer('layer-1')).toEqual({
      id: 'layer-1',
      graphic: { document: { html: '<p>Hi</p>', css: '', js: '' }, fields: [], params: {}, aspectRatio: 4, moments: [], presetId: 'lower-third', hidesCaptions: false },
    });
  });
});
