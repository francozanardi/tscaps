import { describe, expect, it } from 'vitest';
import { RemoveAudioClipsAction } from '@core/audio-mix/actions/RemoveAudioClipsAction';
import { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import { EditorStore } from '@core/editor/store/EditorStore';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { RemoveSoundsOperation } from '@core/editor-operations/services/descriptors/RemoveSoundsOperation';
import { TestAudioMixTelemetry } from '@core/audio-mix/testing/TestAudioMixTelemetry';

/** Sounds taken off by their refs: all of them, or none when one ref names no sound. */

function setUp() {
  const store = new EditorStore();
  const defaults = new AudioClipDefaults();
  const audio = ['a', 'b', 'c'].reduce((mix, id) => mix.withClipAdded(defaults.clipFrom(id, {
    role: 'effect',
    source: { kind: 'builtin', soundId: 'pop-bloop' },
    start: { anchor: { kind: 'video', edge: 'start' }, offsetSec: 1 },
  })), store.snapshot().audio);
  store.patch({ audio });
  return { store, operation: new RemoveSoundsOperation(store, new EditorRefParser(), new RemoveAudioClipsAction(store, new TestAudioMixTelemetry().reporter)) };
}

describe('remove_sounds', () => {
  it('takes the sounds named off and keeps the rest', async () => {
    const { store, operation } = setUp();

    const result = await operation.run({ sounds: ['sound:a', 'sound:c'] });

    expect(result.output).toEqual({ removed: ['sound:a', 'sound:c'] });
    expect(store.snapshot().audio.clips().map((clip) => clip.id)).toEqual(['b']);
  });

  it('refuses them all when one ref names no sound, or is not a sound ref, removing none', async () => {
    const { store, operation } = setUp();
    const before = store.snapshot();

    const result = await operation.run({ sounds: ['sound:a', 'sound:gone', 'word:w1'] });

    expect(result.ok).toBe(false);
    expect(result.problems.map((problem) => problem.ref)).toEqual(['sound:gone', 'word:w1']);
    expect(store.snapshot()).toBe(before);
  });
});
