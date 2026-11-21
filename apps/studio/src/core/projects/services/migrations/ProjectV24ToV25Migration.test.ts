import { describe, expect, it } from 'vitest';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import { ProjectV24ToV25Migration } from '@core/projects/services/migrations/ProjectV24ToV25Migration';

/**
 * A v24 project has no soundtrack. The promise is that it opens exactly
 * as it was, with the empty mix, and that nothing of it is touched: the
 * step exists so that a build still on v24 refuses a v25 project rather
 * than saving it without its sounds.
 */

const migration = new ProjectV24ToV25Migration();

const V24_PROJECT: Record<string, unknown> = {
  version: 24,
  id: 'project',
  name: 'Talk',
  shots: { maxShotSec: 4, shots: [{ id: 'a', startSec: 0 }] },
  cuts: [{ startSec: 1, endSec: 2 }],
};

describe('a v24 project', () => {
  it('is carried as it was', () => {
    expect(migration.migrate(V24_PROJECT)).toEqual(V24_PROJECT);
  });

  it('reads as the empty mix', () => {
    const migrated = migration.migrate(V24_PROJECT);

    expect(AudioMix.fromSnapshot(migrated['audio'] ?? null).isPristine()).toBe(true);
  });

  it('is not the payload it was read from', () => {
    expect(migration.migrate(V24_PROJECT)).not.toBe(V24_PROJECT);
  });
});
