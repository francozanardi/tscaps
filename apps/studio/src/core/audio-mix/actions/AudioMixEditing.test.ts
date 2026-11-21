import { TestAudioMixTelemetry } from '@core/audio-mix/testing/TestAudioMixTelemetry';
import { describe, expect, it } from 'vitest';
import { AddAudioClipAction } from '@core/audio-mix/actions/AddAudioClipAction';
import { PatchAudioClipsAction } from '@core/audio-mix/actions/PatchAudioClipsAction';
import { RemoveAudioClipsAction } from '@core/audio-mix/actions/RemoveAudioClipsAction';
import { SetSourceVolumeAction } from '@core/audio-mix/actions/SetSourceVolumeAction';
import { UseAsMusicAction } from '@core/audio-mix/actions/UseAsMusicAction';
import type { AudioAnchorPoint } from '@core/audio-mix/domain/AudioAnchorPoint';
import { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ShotPartition } from '@core/shots/domain/ShotPartition';

/**
 * Every change to the soundtrack is one undo step, a drag of one slider
 * included, and a new clip starts with what its role calls for.
 */

const ON_WORD: AudioAnchorPoint = { anchor: { kind: 'word', wordId: 'w1', edge: 'start' }, offsetSec: 0 };

function editor() {
  const store = new EditorStore();
  const telemetry = new TestAudioMixTelemetry();
  return {
    store,
    telemetry,
    add: new AddAudioClipAction(store, new AudioClipDefaults()),
    patch: new PatchAudioClipsAction(store, telemetry.reporter),
    remove: new RemoveAudioClipsAction(store, telemetry.reporter),
    setSourceVolume: new SetSourceVolumeAction(store),
    useAsMusic: new UseAsMusicAction(store, new AudioClipDefaults(), telemetry.reporter),
  };
}

describe('adding a clip', () => {
  it('gives an effect a word\'s start, no end, no loop, no fades and no lowering', () => {
    const { store, add } = editor();

    const id = add.execute({ role: 'effect', source: { kind: 'builtin', soundId: 'pop' }, start: ON_WORD });

    expect(store.snapshot().audio.clip(id!)).toMatchObject({
      role: 'effect', start: ON_WORD, end: null, loop: false, volume: 1, fadeInSec: 0, fadeOutSec: 0,
      ducking: { enabled: false },
    });
  });

  it('runs music from the video\'s start to its end, looping and faded, not lowered under speech until asked', () => {
    const { store, add } = editor();

    const id = add.execute({ role: 'music', source: { kind: 'media', mediaId: 'song' }, inSec: 12 });

    expect(store.snapshot().audio.clip(id!)).toMatchObject({
      role: 'music',
      start: { anchor: { kind: 'video', edge: 'start' }, offsetSec: 0 },
      end: { anchor: { kind: 'video', edge: 'end' }, offsetSec: 0 },
      inSec: 12,
      loop: true,
      fadeInSec: 1,
      fadeOutSec: 2,
      ducking: { enabled: false, depthDb: -12 },
    });
  });

  it('mints a new id each time', () => {
    const { add } = editor();
    const draft = { role: 'effect', source: { kind: 'builtin', soundId: 'pop' }, start: ON_WORD } as const;

    expect(add.execute(draft)).not.toBe(add.execute(draft));
  });

  it('adds nothing for a draft naming no file', () => {
    const { store, add } = editor();

    expect(add.execute({ role: 'effect', source: { kind: 'media', mediaId: '' }, start: ON_WORD })).toBeNull();
    expect(store.snapshot().canUndo).toBe(false);
  });

  it('is undone in one step', () => {
    const { store, add } = editor();
    add.execute({ role: 'effect', source: { kind: 'builtin', soundId: 'pop' }, start: ON_WORD });

    store.undo();

    expect(store.snapshot().audio.hasClips()).toBe(false);
  });
});

describe('changing clips', () => {
  it('changes only the fields named, on every clip named', () => {
    const { store, add, patch } = editor();
    const first = add.execute({ role: 'effect', source: { kind: 'builtin', soundId: 'pop' }, start: ON_WORD })!;
    const second = add.execute({ role: 'music', source: { kind: 'media', mediaId: 'song' } })!;

    patch.execute([first, second], { volume: 0.5, ducking: { depthDb: -6 } });

    const audio = store.snapshot().audio;
    expect(audio.clip(first)).toMatchObject({ volume: 0.5, loop: false, ducking: { enabled: false, depthDb: -6 } });
    expect(audio.clip(second)).toMatchObject({ volume: 0.5, loop: true, ducking: { enabled: false, depthDb: -6 } });
  });

  it('takes a whole drag of one slider back in one undo step', () => {
    const { store, add, patch } = editor();
    const id = add.execute({ role: 'effect', source: { kind: 'builtin', soundId: 'pop' }, start: ON_WORD })!;

    patch.execute([id], { volume: 0.8 });
    patch.execute([id], { volume: 0.6 });
    patch.execute([id], { volume: 0.4 });
    store.undo();

    expect(store.snapshot().audio.clip(id)?.volume).toBe(1);
  });

  it('keeps a change to another field as a step of its own', () => {
    const { store, add, patch } = editor();
    const id = add.execute({ role: 'effect', source: { kind: 'builtin', soundId: 'pop' }, start: ON_WORD })!;

    patch.execute([id], { volume: 0.5 });
    patch.execute([id], { fadeInSec: 0.3 });
    store.undo();

    expect(store.snapshot().audio.clip(id)).toMatchObject({ volume: 0.5, fadeInSec: 0 });
  });

  it('never makes an effect loop, and takes no undo step trying', () => {
    const { store, add, patch } = editor();
    const id = add.execute({ role: 'effect', source: { kind: 'builtin', soundId: 'pop' }, start: ON_WORD })!;

    patch.execute([id], { loop: true });

    expect(store.snapshot().audio.clip(id)?.loop).toBe(false);
    store.undo();
    expect(store.snapshot().audio.hasClips()).toBe(false);
  });

  it('lowers music under speech at -12 dB once it is turned on', () => {
    const { store, add, patch } = editor();
    const id = add.execute({ role: 'music', source: { kind: 'media', mediaId: 'song' } })!;

    patch.execute([id], { ducking: { enabled: true } });

    expect(store.snapshot().audio.clip(id)?.ducking).toEqual({ enabled: true, depthDb: -12 });
  });

  it('takes an end anchor away', () => {
    const { store, add, patch } = editor();
    const id = add.execute({ role: 'music', source: { kind: 'media', mediaId: 'song' } })!;

    patch.execute([id], { end: null });

    expect(store.snapshot().audio.clip(id)?.end).toBeNull();
  });

  it('adds no undo step where nothing changes', () => {
    const { store, add, patch } = editor();
    const id = add.execute({ role: 'effect', source: { kind: 'builtin', soundId: 'pop' }, start: ON_WORD })!;
    store.undo();
    store.redo();

    patch.execute([id], { volume: 1 });
    patch.execute(['missing'], { volume: 0.5 });
    store.undo();

    expect(store.snapshot().audio.hasClips()).toBe(false);
  });
});

describe('removing clips', () => {
  it('removes every clip named in one undo step', () => {
    const { store, add, remove } = editor();
    const first = add.execute({ role: 'effect', source: { kind: 'builtin', soundId: 'pop' }, start: ON_WORD })!;
    const second = add.execute({ role: 'effect', source: { kind: 'builtin', soundId: 'ding' }, start: ON_WORD })!;

    remove.execute([first, second]);
    expect(store.snapshot().audio.hasClips()).toBe(false);
    store.undo();

    expect(store.snapshot().audio.clips().map((clip) => clip.id)).toEqual([first, second]);
  });
});

describe('the video\'s own level', () => {
  it('is clamped to 0–2', () => {
    const { store, setSourceVolume } = editor();

    setSourceVolume.execute(3);

    expect(store.snapshot().audio.sourceVolume).toBe(2);
  });

  it('takes a whole drag back in one undo step', () => {
    const { store, setSourceVolume } = editor();

    setSourceVolume.execute(0.8);
    setSourceVolume.execute(0.2);
    setSourceVolume.execute(0);
    store.undo();

    expect(store.snapshot().audio.sourceVolume).toBe(1);
  });
});

describe('using a file as music', () => {
  it('adds music spanning the video where there is none', () => {
    const { store, useAsMusic } = editor();

    const id = useAsMusic.execute({ kind: 'media', mediaId: 'song' }, 'audio-tab');

    expect(store.snapshot().audio.clip(id!)).toMatchObject({
      role: 'music',
      source: { kind: 'media', mediaId: 'song' },
      start: { anchor: { kind: 'video', edge: 'start' } },
      end: { anchor: { kind: 'video', edge: 'end' } },
    });
  });

  it('replaces the file of the music there is, from its start, keeping how it is set', () => {
    const { store, patch, useAsMusic } = editor();
    const id = useAsMusic.execute({ kind: 'media', mediaId: 'song' }, 'audio-tab')!;
    patch.execute([id], { volume: 0.4, inSec: 30, loop: false });

    const replaced = useAsMusic.execute({ kind: 'media', mediaId: 'other' }, 'audio-tab');

    expect(replaced).toBe(id);
    expect(store.snapshot().audio.clips()).toHaveLength(1);
    expect(store.snapshot().audio.clip(id)).toMatchObject({
      source: { kind: 'media', mediaId: 'other' }, inSec: 0, volume: 0.4, loop: false,
    });
  });

  it('is undone in one step, bringing the earlier file back', () => {
    const { store, useAsMusic } = editor();
    const id = useAsMusic.execute({ kind: 'media', mediaId: 'song' }, 'audio-tab')!;
    useAsMusic.execute({ kind: 'media', mediaId: 'other' }, 'audio-tab');

    store.undo();

    expect(store.snapshot().audio.clip(id)?.source).toEqual({ kind: 'media', mediaId: 'song' });
  });

  it('adds no undo step where the file already is the music', () => {
    const { store, useAsMusic } = editor();
    const id = useAsMusic.execute({ kind: 'media', mediaId: 'song' }, 'audio-tab');

    expect(useAsMusic.execute({ kind: 'media', mediaId: 'song' }, 'audio-tab')).toBe(id);
    store.undo();

    expect(store.snapshot().audio.hasClips()).toBe(false);
  });
});

describe('what is reported', () => {
  const INTO_B = { anchor: { kind: 'transition', shotId: 'b' }, offsetSec: 0 } as const;

  it('says whether a sound taken off a transition was the one its kind suggests', () => {
    const { store, add, remove, telemetry } = editor();
    store.patch({ shots: ShotPartition.fromSnapshot({
      maxShotSec: 4,
      shots: [{ id: 'a', startSec: 0, layers: [] }, { id: 'b', startSec: 4, transition: { kind: 'whip', durationSec: 0.4 }, layers: [] }],
    }) });
    const suggested = add.execute({ role: 'effect', source: { kind: 'builtin', soundId: 'whoosh-fast' }, start: INTO_B })!;
    const other = add.execute({ role: 'effect', source: { kind: 'builtin', soundId: 'glitch' }, start: INTO_B })!;

    remove.execute([suggested]);
    remove.execute([other]);

    expect(telemetry.propertiesOf('sound_effect_removed')).toEqual([
      { anchor: 'transition', source: 'builtin', sound_id: 'whoosh-fast', category: 'whoosh', was_suggestion: true },
      { anchor: 'transition', source: 'builtin', sound_id: 'glitch', category: 'glitch', was_suggestion: false },
    ]);
  });

  it('reports the music set, its lowering turned on and off but not its depth, and the music taken off', () => {
    const { patch, remove, useAsMusic, telemetry } = editor();
    const id = useAsMusic.execute({ kind: 'media', mediaId: 'song' }, 'media-bin')!;
    useAsMusic.execute({ kind: 'builtin', soundId: 'riser-long' }, 'audio-tab');

    patch.execute([id], { ducking: { enabled: true } });
    patch.execute([id], { ducking: { depthDb: -20 } });
    patch.execute([id], { ducking: { enabled: false } });
    remove.execute([id]);

    expect(telemetry.events).toEqual([
      ['music_set', { source: 'file', origin: 'media-bin', replaced: false }],
      ['music_set', { source: 'builtin', origin: 'audio-tab', replaced: true }],
      ['music_ducking_toggled', { enabled: true }],
      ['music_ducking_toggled', { enabled: false }],
      ['music_removed', {}],
    ]);
    expect(JSON.stringify(telemetry.events)).not.toContain('song');
  });
});
