import { describe, expect, it } from 'vitest';
import { PatchAudioClipsAction } from '@core/audio-mix/actions/PatchAudioClipsAction';
import { RemoveAudioClipsAction } from '@core/audio-mix/actions/RemoveAudioClipsAction';
import { SetFootageSoundAction } from '@core/audio-mix/actions/SetFootageSoundAction';
import { SetShotVideoVolumeAction } from '@core/audio-mix/actions/SetShotVideoVolumeAction';
import { SetSourceVolumeAction } from '@core/audio-mix/actions/SetSourceVolumeAction';
import { UseAsMusicAction } from '@core/audio-mix/actions/UseAsMusicAction';
import { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import { TestAudioMixTelemetry } from '@core/audio-mix/testing/TestAudioMixTelemetry';
import { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';
import { SetAudioOperation } from '@core/editor-operations/services/descriptors/SetAudioOperation';
import { ShotOperationsFixture } from '@core/editor-operations/testing/ShotOperationsFixture';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';

/**
 * The soundtrack's levels and music set by a program: the video's own
 * sound, overall, per shot and per b-roll, the music and how it plays,
 * and placed sounds' levels and nudges, all of them or, when one part is
 * wrong, none.
 */

function setUp() {
  const fixture = new ShotOperationsFixture();
  fixture.addFile('song', 'audio', 30);
  fixture.addFile('other-song', 'audio', 40);
  fixture.addFile('footage', 'video');
  fixture.addFile('photo', 'image');
  const defaults = new AudioClipDefaults();
  const effect = defaults.clipFrom('pop', {
    role: 'effect',
    source: { kind: 'builtin', soundId: 'pop-bloop' },
    start: { anchor: { kind: 'shot', shotId: 'b', edge: 'start' }, offsetSec: 0 },
  });
  fixture.store.patch({
    shots: ShotPartition.fromSnapshot({
      maxShotSec: 4,
      shots: [
        { id: 'a', startSec: 0 },
        { id: 'b', startSec: 10, layers: [
          { id: 'broll', mediaId: 'footage', inSec: 0, outSec: null, loop: false },
          { id: 'still', mediaId: 'photo', inSec: 0, outSec: null, loop: false },
        ] },
      ],
    }),
    audio: fixture.store.snapshot().audio.withClipAdded(effect),
  });
  const { store, parser, shotRefs, media } = fixture;
  const reporter = new TestAudioMixTelemetry().reporter;
  const operation = new SetAudioOperation(
    store,
    parser,
    shotRefs,
    media,
    new ShotLayerAssetReader(),
    new ReadoutFormatter(),
    new SetSourceVolumeAction(store),
    new SetShotVideoVolumeAction(store, fixture.materializer),
    new SetFootageSoundAction(store),
    new UseAsMusicAction(store, defaults, reporter),
    new PatchAudioClipsAction(store, reporter),
    new RemoveAudioClipsAction(store, reporter),
  );
  return { store, operation };
}

function musicOf(store: ReturnType<typeof setUp>['store']) {
  return store.snapshot().audio.clips().find((clip) => clip.role === 'music') ?? null;
}

describe('set_audio', () => {
  it('sets the video\'s own sound, a shot\'s and a b-roll\'s, answering each as the project holds it', async () => {
    const { store, operation } = setUp();

    const result = await operation.run({
      videoVolume: 0.5,
      shots: [{ shot: 'shot:a', volume: 0 }],
      layers: [{ layer: 'layer:broll', volume: 1.2 }],
    });

    expect(result).toEqual({
      ok: true,
      output: {
        videoVolume: 0.5,
        shots: [{ shot: 'shot:a', volume: 0 }],
        layers: [{ layer: 'layer:broll', volume: 1.2 }],
      },
      problems: [],
    });
    const audio = store.snapshot().audio;
    expect([audio.sourceVolume, audio.shotVideoVolumeOf('a'), audio.shotVideoVolumeOf('b'), audio.footageVolumeOf('broll')]).toEqual([0.5, 0, 1, 1.2]);
  });

  it('adds music from an audio file as the Audio tab does, not lowered under speech until asked', async () => {
    const { store, operation } = setUp();

    const added = await operation.run({ music: { media: 'song', volume: 0.3 } });
    const ducked = await operation.run({ music: { ducking: true, duckingDb: -20 } });

    const ref = `sound:${musicOf(store)?.id}`;
    expect(added.output).toEqual({ music: {
      sound: ref, file: 'song.file', volume: 0.3, inSec: 0, fadeInSec: 1, fadeOutSec: 2, loop: true, ducking: false, duckingDb: -12,
    } });
    expect(ducked.output).toEqual({ music: expect.objectContaining({ sound: ref, ducking: true, duckingDb: -20 }) });
  });

  it('plays another file as the music keeping how it plays, and takes it away with null', async () => {
    const { store, operation } = setUp();
    await operation.run({ music: { media: 'song', volume: 0.3, inSec: 4, loop: false, ducking: true } });

    await operation.run({ music: { media: 'media:other-song' } });
    const replaced = musicOf(store);
    const removed = await operation.run({ music: null });

    expect(replaced).toMatchObject({ source: { kind: 'media', mediaId: 'other-song' }, volume: 0.3, inSec: 0, loop: false, ducking: { enabled: true } });
    expect(removed.output).toEqual({ music: null });
    expect(musicOf(store)).toBeNull();
  });

  it('changes a placed sound\'s level and nudge, keeping its ref', async () => {
    const { store, operation } = setUp();

    const result = await operation.run({ sounds: [{ sound: 'sound:pop', volume: 0.6, offsetSec: -0.25 }] });

    expect(result.output).toEqual({ sounds: [{ sound: 'sound:pop', volume: 0.6, offsetSec: -0.25 }] });
    expect(store.snapshot().audio.clip('pop')).toMatchObject({
      volume: 0.6,
      start: { anchor: { kind: 'shot', shotId: 'b', edge: 'start' }, offsetSec: -0.25 },
    });
  });

  it('changes nothing when one part is wrong, naming every wrong part', async () => {
    const { store, operation } = setUp();
    const before = store.snapshot();

    const result = await operation.run({
      videoVolume: 0.2,
      layers: [{ layer: 'layer:still', volume: 1 }],
      music: { media: 'footage' },
      sounds: [{ sound: 'sound:pop', offsetSec: 3 }, { sound: 'sound:gone', volume: 1 }],
    });

    expect(result.ok).toBe(false);
    expect(result.problems.map((problem) => problem.message)).toEqual([
      expect.stringMatching(/layer:still shows a picture, which has no sound/),
      expect.stringMatching(/"footage.file" is a video file; only an audio file can be the music/),
      expect.stringMatching(/sounds\.0\.offsetSec: a sound placed on something of the edit moves at most 1 s/),
      expect.stringMatching(/sound:gone is not a sound of the project any more/),
    ]);
    expect(store.snapshot()).toBe(before);
  });

  it('refuses music settings while there is no music and no file is given', async () => {
    const { store, operation } = setUp();
    const before = store.snapshot();

    const result = await operation.run({ music: { volume: 0.5 } });

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toMatch(/there is no music yet; give media/);
    expect(store.snapshot()).toBe(before);
  });
});
