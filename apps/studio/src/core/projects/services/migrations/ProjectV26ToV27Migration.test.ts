import { describe, expect, it } from 'vitest';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import { ProjectV26ToV27Migration } from '@core/projects/services/migrations/ProjectV26ToV27Migration';

/**
 * A v26 project hears no layer's own sound and gives no shot a video
 * level of its own. The
 * promise is that it opens exactly as it was: the step exists so that a
 * build still on v26 refuses a v27 project rather than saving it without
 * them.
 */

const migration = new ProjectV26ToV27Migration();

const V26_PROJECT: Record<string, unknown> = {
  version: 26,
  id: 'project',
  name: 'Talk',
  audio: { sourceVolume: 0.5, clips: [] },
};

describe('a v26 project', () => {
  it('is carried as it was, in a payload of its own', () => {
    const migrated = migration.migrate(V26_PROJECT);

    expect(migrated).toEqual(V26_PROJECT);
    expect(migrated).not.toBe(V26_PROJECT);
  });

  it("reads with every layer silent and every shot at the video's level", () => {
    const audio = AudioMix.fromSnapshot(migration.migrate(V26_PROJECT)['audio']);

    expect(audio.footageSounds()).toEqual([]);
    expect(audio.hasShotVideoVolumes()).toBe(false);
    expect(audio.sourceVolume).toBe(0.5);
  });
});
