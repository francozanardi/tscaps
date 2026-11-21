import { describe, expect, it } from 'vitest';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import { ProjectV34ToV35Migration } from '@core/projects/services/migrations/ProjectV34ToV35Migration';

/** A v34 project placed no sound on an emoji; its sounds open where they were. */

const migration = new ProjectV34ToV35Migration();

const V34_PROJECT: Record<string, unknown> = {
  version: 34,
  id: 'project',
  name: 'Talk',
  audio: {
    clips: [{
      id: 'clip-1',
      role: 'effect',
      source: { kind: 'builtin', soundId: 'pop-mouth' },
      start: { anchor: { kind: 'word', wordId: 'w1', edge: 'start' }, offsetSec: 0 },
      volume: 0.4,
    }],
  },
};

describe('a v34 project', () => {
  it('is carried as it was, in a payload of its own', () => {
    const migrated = migration.migrate(V34_PROJECT);

    expect(migrated).toEqual(V34_PROJECT);
    expect(migrated).not.toBe(V34_PROJECT);
  });

  it('keeps its sounds on the words they were on', () => {
    const audio = AudioMix.fromSnapshot(migration.migrate(V34_PROJECT)['audio']);

    expect(audio.clips().map((clip) => clip.start.anchor)).toEqual([{ kind: 'word', wordId: 'w1', edge: 'start' }]);
  });
});
