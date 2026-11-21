import { describe, expect, it } from 'vitest';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';

/**
 * A stored soundtrack is read back as far as it can be trusted: a clip
 * that cannot say what it plays or where it starts is dropped, anything
 * else falls back or is clamped, so a damaged payload never produces a
 * clip nobody can play or a level nobody can reach with a slider.
 */

function storedClip(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'pop',
    role: 'effect',
    source: { kind: 'builtin', soundId: 'pop' },
    start: { anchor: { kind: 'word', wordId: 'w1', edge: 'start' }, offsetSec: 0 },
    end: null,
    inSec: 0,
    loop: false,
    volume: 1,
    fadeInSec: 0,
    fadeOutSec: 0,
    ducking: { enabled: false, depthDb: -12 },
    ...overrides,
  };
}

function read(...clips: ReadonlyArray<unknown>): AudioMix {
  return AudioMix.fromSnapshot({ sourceVolume: 1, clips });
}

describe('reading a stored mix', () => {
  it('keeps a well-formed clip as it was', () => {
    expect(read(storedClip()).clips()).toEqual([storedClip()]);
  });

  it('keeps a clip on a shot\'s camera, and drops one that names no shot', () => {
    expect(read(storedClip({ start: { anchor: { kind: 'camera', shotId: 'b' }, offsetSec: -0.07 } })).clips()[0]?.start)
      .toEqual({ anchor: { kind: 'camera', shotId: 'b' }, offsetSec: -0.07 });
    expect(read(storedClip({ start: { anchor: { kind: 'camera' }, offsetSec: 0 } })).clips()).toEqual([]);
  });

  it('keeps a clip on an emoji, and drops one that names no emoji', () => {
    expect(read(storedClip({ start: { anchor: { kind: 'emoji', decorationId: 'w1:d' }, offsetSec: -0.05 } })).clips()[0]?.start)
      .toEqual({ anchor: { kind: 'emoji', decorationId: 'w1:d' }, offsetSec: -0.05 });
    expect(read(storedClip({ start: { anchor: { kind: 'emoji' }, offsetSec: 0 } })).clips()).toEqual([]);
  });

  it('keeps a clip on a transition, and drops one that names no shot', () => {
    expect(read(storedClip({ start: { anchor: { kind: 'transition', shotId: 'b' }, offsetSec: -0.1 } })).clips()[0]?.start)
      .toEqual({ anchor: { kind: 'transition', shotId: 'b' }, offsetSec: -0.1 });
    expect(read(storedClip({ start: { anchor: { kind: 'transition' }, offsetSec: 0 } })).clips()).toEqual([]);
  });

  it('drops a clip with no id', () => {
    expect(read(storedClip({ id: '' }), storedClip({ id: undefined })).hasClips()).toBe(false);
  });

  it('drops a clip with no file to play', () => {
    expect(read(
      storedClip({ source: undefined }),
      storedClip({ source: { kind: 'media', mediaId: '' } }),
      storedClip({ source: { kind: 'stock', url: 'https://example.com/a.mp3' } }),
    ).hasClips()).toBe(false);
  });

  it('drops a clip whose start is anchored to a kind it does not know', () => {
    expect(read(storedClip({ start: { anchor: { kind: 'beat', index: 3 }, offsetSec: 0 } })).hasClips()).toBe(false);
  });

  it('reads an end anchor of a kind it does not know as no end', () => {
    expect(read(storedClip({ end: { anchor: { kind: 'beat', index: 3 }, offsetSec: 0 } })).clip('pop')?.end).toBeNull();
  });

  it('keeps the first of two clips sharing an id', () => {
    const mix = read(storedClip({ volume: 0.5 }), storedClip({ volume: 1.5 }));

    expect(mix.clips().map((clip) => clip.volume)).toEqual([0.5]);
  });

  it('clamps every number to its range', () => {
    const clip = read(storedClip({
      volume: 9,
      fadeInSec: -1,
      fadeOutSec: 60,
      inSec: -3,
      start: { anchor: { kind: 'video', edge: 'start' }, offsetSec: -500 },
      ducking: { enabled: true, depthDb: -100 },
    })).clip('pop')!;

    expect(clip).toMatchObject({ volume: 2, fadeInSec: 0, fadeOutSec: 10, inSec: 0, ducking: { enabled: true, depthDb: -40 } });
    expect(clip.start.offsetSec).toBe(-60);
  });

  it('falls back to neutral values for what is missing or not a number', () => {
    const clip = read({
      id: 'bare',
      source: { kind: 'media', mediaId: 'song' },
      start: { anchor: { kind: 'layer', layerId: 'l1', edge: 'sideways' } },
      volume: 'loud',
    }).clip('bare');

    expect(clip).toEqual({
      id: 'bare',
      role: 'effect',
      source: { kind: 'media', mediaId: 'song' },
      start: { anchor: { kind: 'layer', layerId: 'l1', edge: 'entry' }, offsetSec: 0 },
      end: null,
      inSec: 0,
      loop: false,
      volume: 1,
      fadeInSec: 0,
      fadeOutSec: 0,
      ducking: { enabled: false, depthDb: -12 },
    });
  });

  it('reads an effect stored looping as playing once, and keeps music looping', () => {
    const [effect, music] = read(storedClip({ loop: true }), storedClip({ id: 'song', role: 'music', loop: true })).clips();

    expect(effect!.loop).toBe(false);
    expect(music!.loop).toBe(true);
  });

  it('clamps the video\'s own level, and takes it at full where it cannot be read', () => {
    expect(AudioMix.fromSnapshot({ sourceVolume: 7, clips: [] }).sourceVolume).toBe(2);
    expect(AudioMix.fromSnapshot({ sourceVolume: null, clips: [] }).sourceVolume).toBe(1);
  });

  it('reads anything that is not a mix as the empty one', () => {
    expect(AudioMix.fromSnapshot('noise').isPristine()).toBe(true);
    expect(AudioMix.fromSnapshot({ clips: 'noise' }).isPristine()).toBe(true);
  });
});

describe('an edit', () => {
  it('is checked as a stored clip is', () => {
    const mix = read(storedClip()).withClipsPatched(['pop'], { volume: 5, fadeOutSec: -2 });

    expect(mix.clip('pop')).toMatchObject({ volume: 2, fadeOutSec: 0 });
  });

  it('refuses a second clip under an id already held', () => {
    const mix = read(storedClip());

    expect(mix.withClipAdded(read(storedClip({ volume: 0.2 })).clip('pop')!)).toBe(mix);
  });

  it('moves the offset of clips placed against different things, each keeping its anchor', () => {
    const mix = read(
      storedClip({ id: 'a', start: { anchor: { kind: 'layer', layerId: 'one', edge: 'entry' }, offsetSec: 0 } }),
      storedClip({ id: 'b', start: { anchor: { kind: 'layer', layerId: 'two', edge: 'entry' }, offsetSec: 0.3 } }),
    ).withClipsPatched(['a', 'b'], { startOffsetSec: -0.25 });

    expect(mix.clip('a')!.start).toEqual({ anchor: { kind: 'layer', layerId: 'one', edge: 'entry' }, offsetSec: -0.25 });
    expect(mix.clip('b')!.start).toEqual({ anchor: { kind: 'layer', layerId: 'two', edge: 'entry' }, offsetSec: -0.25 });
  });

  it('changes nothing where the patch leaves every clip as it was', () => {
    const mix = read(storedClip());

    expect(mix.withClipsPatched(['pop'], { volume: 1 })).toBe(mix);
    expect(mix.withClipsPatched(['missing'], { volume: 0.5 })).toBe(mix);
  });
});

describe('the files a mix plays', () => {
  it('are the media files its clips name, never the bundled sounds', () => {
    const mix = read(storedClip({ id: 'a', source: { kind: 'media', mediaId: 'song' } }), storedClip({ id: 'b' }));

    expect([...mix.mediaIdsInUse()]).toEqual(['song']);
  });

  it('lose every clip playing a deleted file', () => {
    const mix = read(
      storedClip({ id: 'a', source: { kind: 'media', mediaId: 'song' } }),
      storedClip({ id: 'b', source: { kind: 'media', mediaId: 'song' } }),
      storedClip({ id: 'c' }),
    ).withoutMedia('song');

    expect(mix.clips().map((clip) => clip.id)).toEqual(['c']);
  });
});

describe('what the shots do to the sound', () => {
  it("reads back the layers heard and the shots' video levels, dropping what cannot be trusted", () => {
    const mix = AudioMix.fromSnapshot({
      sourceVolume: 1,
      clips: [],
      footageSounds: [{ layerId: 'broll', volume: 5 }, { layerId: 'broll', volume: 0.5 }, { volume: 1 }, { layerId: 'other' }, { layerId: 'silent', volume: 0 }],
      shotVideoVolumes: [{ shotId: 'shot', volume: 0 }, { shotId: 'shot', volume: 0.5 }, { shotId: 'full', volume: 1 }, { volume: 0 }, { shotId: 'loud', volume: 9 }],
    });

    expect(mix.footageSounds()).toEqual([{ layerId: 'broll', volume: 2 }, { layerId: 'other', volume: 1 }]);
    expect([...mix.shotVideoVolumes()]).toEqual([['shot', 0], ['loud', 2]]);
    expect(AudioMix.fromSnapshot(mix.toSnapshot()).toSnapshot()).toEqual(mix.toSnapshot());
  });

  it('hears a layer at a level, changes it in place, and lets it go silent again', () => {
    const heard = AudioMix.empty().withFootageSound(['first', 'second'], 0.5);

    expect(heard.withFootageSound(['first'], 1).footageSounds()).toEqual([{ layerId: 'first', volume: 1 }, { layerId: 'second', volume: 0.5 }]);
    expect(heard.withFootageSound(['first'], 0).footageVolumeOf('first')).toBe(0);
    expect(heard.withFootageSound(['first'], 0).footageSounds()).toEqual([{ layerId: 'second', volume: 0.5 }]);
    expect(heard.withFootageSound(['second'], 0.5)).toBe(heard);
  });

  it('sets a shot\'s video level, clamped, back to no entry at 1, the same mix where nothing changes', () => {
    const muted = AudioMix.empty().withShotVideoVolume(['shot'], 0);

    expect(muted.shotVideoVolumeOf('shot')).toBe(0);
    expect(muted.shotVideoVolumeOf('other')).toBe(1);
    expect(muted.withShotVideoVolume(['shot'], 0)).toBe(muted);
    expect(muted.withShotVideoVolume(['shot'], 5).shotVideoVolumeOf('shot')).toBe(2);
    expect(muted.withShotVideoVolume(['shot'], 1).isPristine()).toBe(true);
  });

  it("is worth storing once a layer is heard or a shot's video level changes, and only stores what it holds", () => {
    expect(AudioMix.empty().withFootageSound(['broll'], 1).isPristine()).toBe(false);
    expect(AudioMix.empty().withShotVideoVolume(['shot'], 0.5).isPristine()).toBe(false);
    expect(AudioMix.empty().toSnapshot()).toEqual({ sourceVolume: 1, clips: [] });
  });
});
