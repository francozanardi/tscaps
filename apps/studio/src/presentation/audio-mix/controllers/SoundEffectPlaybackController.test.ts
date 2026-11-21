import { describe, expect, it } from 'vitest';
import { RenderTimeMap } from '@tscaps/engine';
import { SoundEffectPlaybackController } from '@presentation/audio-mix/controllers/SoundEffectPlaybackController';

/**
 * Clicking an effect is asking to hear it where it lands. Seeking to
 * its start alone shows a frame and plays nothing; playing from there
 * on runs into whatever follows. So the video plays from a moment
 * before the effect to a moment after it, long enough to read as a
 * moment even for a click of a sound, and a second click stops it.
 *
 * The surface carries out the seek, the stop and the play; what is
 * promised here is where it is asked to start, where to stop, and that
 * the stop is asked for after the seek that would drop it.
 */

class Playhead {
  playing = false;
  atSec = 0;

  isPlaying(): boolean {
    return this.playing;
  }

  timeSec(): number {
    return this.atSec;
  }
}

function surface() {
  const calls: string[] = [];
  const playhead = new Playhead();
  const controller = new SoundEffectPlaybackController(
    playhead,
    (sourceSec) => {
      calls.push(`seek:${sourceSec}`);
      playhead.atSec = sourceSec;
    },
    () => {
      calls.push('play');
      playhead.playing = true;
    },
    () => {
      calls.push('pause');
      playhead.playing = false;
    },
    (sourceSec) => calls.push(`stopAt:${sourceSec}`),
    () => calls.push('unmute'),
  );
  return { calls, playhead, controller };
}

const NO_CUTS = new RenderTimeMap([]);

describe('playing the video around an effect', () => {
  it('starts half a second before it and stops half a second after it', () => {
    const { calls, controller } = surface();

    controller.toggle('whoosh', { startSec: 4, endSec: 5.25 }, NO_CUTS);

    expect(calls).toEqual(['seek:3.5', 'stopAt:5.75', 'unmute', 'play']);
  });

  it('plays at least a second and a half for a short sound', () => {
    const { calls, controller } = surface();

    controller.toggle('click', { startSec: 4, endSec: 4.1 }, NO_CUTS);

    expect(calls).toContain('seek:3.5');
    expect(calls).toContain('stopAt:5');
  });

  it('never starts before the video does', () => {
    const { calls, controller } = surface();

    controller.toggle('intro', { startSec: 0.2, endSec: 0.4 }, NO_CUTS);

    expect(calls).toContain('seek:0');
    expect(calls).toContain('stopAt:1.5');
  });

  it('plays the shortest stretch where the sound\'s length is not known', () => {
    const { calls, controller } = surface();

    controller.toggle('reading', { startSec: 4, endSec: Infinity }, NO_CUTS);

    expect(calls).toContain('stopAt:5');
  });

  it('places the stretch in source time, past the cuts before it', () => {
    const { calls, controller } = surface();

    controller.toggle('whoosh', { startSec: 4, endSec: 5 }, new RenderTimeMap([{ startSec: 1, endSec: 3 }]));

    expect(calls).toContain('seek:5.5');
    expect(calls).toContain('stopAt:7.5');
  });

  it('asks for the stop after the seek that would drop it, and before it plays', () => {
    const { calls, controller } = surface();

    controller.toggle('whoosh', { startSec: 4, endSec: 5 }, NO_CUTS);

    expect(calls.indexOf('seek:3.5')).toBeLessThan(calls.indexOf('stopAt:5.5'));
    expect(calls.indexOf('stopAt:5.5')).toBeLessThan(calls.indexOf('play'));
  });
});

describe('a second click', () => {
  it('stops the playback while it runs', () => {
    const { calls, playhead, controller } = surface();
    controller.toggle('whoosh', { startSec: 4, endSec: 5 }, NO_CUTS);
    playhead.atSec = 4.2;
    calls.length = 0;

    controller.toggle('whoosh', { startSec: 4, endSec: 5 }, NO_CUTS);

    expect(calls).toEqual(['pause']);
  });

  it('plays it again once that playback has come to rest', () => {
    const { calls, playhead, controller } = surface();
    controller.toggle('whoosh', { startSec: 4, endSec: 5 }, NO_CUTS);
    playhead.playing = false;
    calls.length = 0;

    controller.toggle('whoosh', { startSec: 4, endSec: 5 }, NO_CUTS);

    expect(calls).toContain('play');
  });

  it('plays it again where the user moved the playhead out of the stretch', () => {
    const { calls, playhead, controller } = surface();
    controller.toggle('whoosh', { startSec: 4, endSec: 5 }, NO_CUTS);
    playhead.atSec = 9;
    calls.length = 0;

    controller.toggle('whoosh', { startSec: 4, endSec: 5 }, NO_CUTS);

    expect(calls).toContain('seek:3.5');
  });

  it('on another effect plays that one rather than stopping', () => {
    const { calls, playhead, controller } = surface();
    controller.toggle('whoosh', { startSec: 4, endSec: 5 }, NO_CUTS);
    playhead.atSec = 4.2;
    calls.length = 0;

    controller.toggle('pop', { startSec: 4.1, endSec: 4.3 }, NO_CUTS);

    expect(calls).not.toContain('pause');
    expect(calls).toContain('play');
  });
});
