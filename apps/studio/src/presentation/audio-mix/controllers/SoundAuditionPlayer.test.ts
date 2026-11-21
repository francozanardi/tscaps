import { describe, expect, it } from 'vitest';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { SoundAuditionOutput, SoundAuditionVoice } from '@core/audio-mix/domain/SoundAuditionOutput';
import { StaticFileBuiltinSoundCatalog } from '@core/audio-mix/infrastructure/StaticFileBuiltinSoundCatalog';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';
import { SoundAuditionPlayer } from '@presentation/audio-mix/controllers/SoundAuditionPlayer';

/**
 * A clip's play button is a promise about what the export will sound
 * like: a sound turned down to 30 % and heard at full volume from its
 * button tells the user their slider did nothing. So a clip is heard as
 * it is placed — from its in-point, at its volume, following the
 * slider while it plays — while a file in the picker is heard as it is.
 */

/** What is being heard, as an ear would report it. */
class HeardSound implements SoundAuditionVoice {
  stopped = false;

  constructor(
    readonly file: string | Blob,
    readonly startSec: number,
    public gain: number,
    readonly finish: () => void,
  ) {}

  setGain(gain: number): void {
    this.gain = gain;
  }

  stop(): void {
    this.stopped = true;
  }
}

class Speaker implements SoundAuditionOutput {
  readonly sounds: HeardSound[] = [];

  play(file: string | Blob, startSec: number, gain: number, onEnded: () => void): SoundAuditionVoice {
    const sound = new HeardSound(file, startSec, gain, onEnded);
    this.sounds.push(sound);
    return sound;
  }

  /** What is still playing. */
  audible(): HeardSound[] {
    return this.sounds.filter((sound) => !sound.stopped);
  }
}

class StoredFiles implements MediaAssetBytesRepository {
  async load(assetId: string): Promise<Blob | null> {
    return assetId === 'song' ? new Blob(['song']) : null;
  }

  async store(): Promise<void> {}
  async reassign(): Promise<void> {}
  async delete(): Promise<void> {}
}

function effect(id: string, overrides: Partial<AudioClip> = {}): AudioClip {
  return {
    id, role: 'effect', source: { kind: 'builtin', soundId: 'pop' }, start: { anchor: { kind: 'video', edge: 'start' }, offsetSec: 0 },
    end: null, inSec: 0, loop: false, volume: 1, fadeInSec: 0, fadeOutSec: 0, ducking: { enabled: false, depthDb: -12 }, ...overrides,
  };
}

function player() {
  const speaker = new Speaker();
  const catalog = new StaticFileBuiltinSoundCatalog([{ id: 'pop', name: 'Pop', category: 'pop', lengthSec: 0.2, description: '', underVoiceVolume: 0.15 }], '/app/');
  return { speaker, player: new SoundAuditionPlayer(catalog, new StoredFiles(), speaker) };
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('hearing a clip', () => {
  it('plays it at its volume, from its in-point', async () => {
    const { speaker, player: audition } = player();

    audition.toggleClip(effect('quiet', { volume: 0.3, inSec: 0.05 }));
    await settled();

    expect(speaker.audible()).toMatchObject([{ file: '/app/sounds/pop.ogg', gain: 0.3, startSec: 0.05 }]);
  });

  it('follows its volume while it plays', async () => {
    const { speaker, player: audition } = player();
    const clip = effect('quiet', { volume: 0.3 });
    audition.toggleClip(clip);
    await settled();

    audition.follow([{ ...clip, volume: 1.6 }]);

    expect(speaker.audible()[0]?.gain).toBe(1.6);
  });

  it('takes a volume moved while its file is still read', async () => {
    const { speaker, player: audition } = player();
    const clip = effect('quiet', { source: { kind: 'media', mediaId: 'song' }, volume: 0.3 });

    audition.toggleClip(clip);
    audition.follow([{ ...clip, volume: 0.8 }]);
    await settled();

    expect(speaker.audible()[0]?.gain).toBe(0.8);
  });

  it('stops once the clip is removed or plays another file', async () => {
    const { speaker, player: audition } = player();
    const clip = effect('quiet');
    audition.toggleClip(clip);
    await settled();

    audition.follow([{ ...clip, source: { kind: 'media', mediaId: 'song' } }]);

    expect(speaker.audible()).toEqual([]);
    expect(audition.playingKey()).toBeNull();
  });

  it('is a sound of its own beside another clip playing the same file', async () => {
    const { player: audition } = player();
    const first = effect('first');
    const second = effect('second');

    audition.toggleClip(first);

    expect(audition.playingKey()).toBe(audition.clipKeyOf(first));
    expect(audition.playingKey()).not.toBe(audition.clipKeyOf(second));
  });

  it('leaves the volume of another clip alone', async () => {
    const { speaker, player: audition } = player();
    const playing = effect('playing', { volume: 0.5 });
    audition.toggleClip(playing);
    await settled();

    audition.follow([playing, effect('other', { volume: 2 })]);

    expect(speaker.audible()[0]?.gain).toBe(0.5);
  });
});

describe('hearing a file', () => {
  it('plays it as it is, from its start', async () => {
    const { speaker, player: audition } = player();

    audition.toggle({ kind: 'builtin', soundId: 'pop' });
    await settled();

    expect(speaker.audible()).toMatchObject([{ gain: 1, startSec: 0 }]);
  });

  it('is stopped by playing anything else, and by being played again', async () => {
    const { speaker, player: audition } = player();
    audition.toggle({ kind: 'builtin', soundId: 'pop' });
    await settled();

    audition.toggleClip(effect('clip'));
    await settled();
    expect(speaker.audible()).toHaveLength(1);
    audition.toggleClip(effect('clip'));

    expect(speaker.audible()).toEqual([]);
  });

  it('says nothing plays once it reaches its end', async () => {
    const { speaker, player: audition } = player();
    audition.toggle({ kind: 'builtin', soundId: 'pop' });
    await settled();

    speaker.sounds[0]!.finish();

    expect(audition.playingKey()).toBeNull();
  });

  it('stops quietly where the file cannot be had', async () => {
    const { speaker, player: audition } = player();

    audition.toggle({ kind: 'media', mediaId: 'deleted' });
    await settled();

    expect(speaker.sounds).toEqual([]);
    expect(audition.playingKey()).toBeNull();
  });
});
