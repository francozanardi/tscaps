import { describe, expect, it } from 'vitest';
import { ProjectV21ToV22Migration } from '@core/projects/services/migrations/ProjectV21ToV22Migration';

/**
 * Shot layer motions written as a fixed kind, on projects saved before
 * motions were presets.
 *
 * The promise is that a layer comes in and leaves the way it did: the
 * same preset, as long, and a slide travelling the same way across the
 * frame.
 */

const migration = new ProjectV21ToV22Migration();

function layer(id: string, entrance: unknown, exit: unknown): Record<string, unknown> {
  return { id, mediaId: `${id}-file`, inSec: 0, outSec: null, loop: false, placement: { kind: 'full', fit: 'cover' }, entrance, exit };
}

/**
 * The layers as the migrated payload holds them, by id. Read as stored
 * rather than through the partition, which has moved on since v22: the
 * steps after this one are what take them further.
 */
function migratedPartition(layers: Record<string, unknown>[]): { findLayer(id: string): Record<string, unknown> | undefined } {
  const migrated = migration.migrate({ version: 21, shots: { maxShotSec: 6, shots: [{ id: 'a', startSec: 0, layers }] } });
  const shots = migrated.shots as { shots: Array<{ layers: Array<Record<string, unknown>> }> };
  return { findLayer: (id) => shots.shots[0]!.layers.find((held) => held['id'] === id) };
}

type StoredMotion = { params: Record<string, unknown> } | null | undefined;

describe('ProjectV21ToV22Migration', () => {
  it('keeps a fade and a pop as the preset of the same name, as long', () => {
    const partition = migratedPartition([layer('clip', { kind: 'pop', durationSec: 0.7 }, { kind: 'fade', durationSec: 0.3 })]);

    expect(partition.findLayer('clip')).toMatchObject({
      entrance: { presetId: 'pop', params: { duration: 0.7 } },
      exit: { presetId: 'fade', params: { duration: 0.3 } },
    });
  });

  it('turns a slide\'s side into the way it travels: in from a side travels away from it, out by a side towards it', () => {
    const sides = ['left', 'right', 'top', 'bottom'];
    const partition = migratedPartition(sides.map((side) => layer(side, { kind: 'slide', durationSec: 0.5, side }, { kind: 'slide', durationSec: 0.5, side })));

    expect(sides.map((side) => (partition.findLayer(side)?.['entrance'] as StoredMotion)?.params['direction'])).toEqual(['right', 'left', 'down', 'up']);
    expect(sides.map((side) => (partition.findLayer(side)?.['exit'] as StoredMotion)?.params['direction'])).toEqual(['left', 'right', 'up', 'down']);
  });

  it('reads what v21 could not read the way v21 did: no motion, a fresh duration, a slide in from the left and out by the right', () => {
    const partition = migratedPartition([
      layer('none', { kind: 'none' }, undefined),
      layer('unknown', { kind: 'spin', durationSec: 1 }, 'fade'),
      layer('loose', { kind: 'slide', durationSec: 'slow', side: 'toString' }, { kind: 'slide', durationSec: 40 }),
    ]);

    expect(partition.findLayer('none')).toMatchObject({ entrance: null, exit: null });
    expect(partition.findLayer('unknown')).toMatchObject({ entrance: null, exit: null });
    expect(partition.findLayer('loose')).toMatchObject({
      entrance: { presetId: 'slide', params: { duration: 0.4, direction: 'right' } },
      exit: { presetId: 'slide', params: { duration: 2, direction: 'right' } },
    });
  });

  it('leaves a project with no shots as it was', () => {
    expect(migration.migrate({ version: 21, title: 'x' })).toEqual({ version: 21, title: 'x' });
  });
});
