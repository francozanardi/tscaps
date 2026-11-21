import { describe, expect, it } from 'vitest';
import { RangeReplayController } from '@presentation/editor/controllers/RangeReplayController';

/**
 * A replay hands the surface a bound it must not lose. Seeking is what
 * drops a standing bound, so the order the two are asked in is the
 * difference between a stretch that stops and one that plays on to the
 * end of the file.
 *
 * And it takes the playhead from nobody. A user watching their own
 * video is already seeing whatever was just changed; yanking the
 * playhead backwards to show it to them is the one thing they did not
 * ask for.
 */

class Playhead {
  isPlayingNow = false;
  atSec = 0;

  isPlaying(): boolean {
    return this.isPlayingNow;
  }

  timeSec(): number {
    return this.atSec;
  }
}

interface Recording {
  readonly calls: string[];
  readonly playhead: Playhead;
  readonly controller: RangeReplayController;
}

function recording(): Recording {
  const calls: string[] = [];
  const playhead = new Playhead();
  const controller = new RangeReplayController(
    playhead,
    (timeSec: number) => calls.push(`seek:${timeSec}`),
    () => calls.push('play'),
    (timeSec: number) => calls.push(`stopAt:${timeSec}`),
    (timeSec: number) => calls.push(`mute:${timeSec}`),
    () => calls.push('unmute'),
  );
  return { calls, playhead, controller };
}

describe('replaying a stretch', () => {
  it('asks for its stop after the seek that would have dropped it', () => {
    const { calls, controller } = recording();

    controller.replay(2, 3);

    expect(calls.indexOf('seek:2')).toBeLessThan(calls.indexOf('stopAt:3'));
  });

  it('is bounded before it is playing', () => {
    const { calls, controller } = recording();

    controller.replay(2, 3);

    expect(calls.indexOf('stopAt:3')).toBeLessThan(calls.indexOf('play'));
  });

  it('silences from the stretch\'s own start rather than from now', () => {
    const { calls, controller } = recording();

    controller.replay(2, 3);

    expect(calls).toContain('mute:2');
  });

  it('plays with its sound when asked, lifting a silence a replay before it left', () => {
    const { calls, controller } = recording();

    controller.replay(2, 3, true);

    expect(calls).toContain('unmute');
    expect(calls.some((call) => call.startsWith('mute:'))).toBe(false);
  });

  it('touches nothing for a stretch that ends where it begins', () => {
    const { calls, controller } = recording();

    controller.replay(3, 3);

    expect(calls).toEqual([]);
  });
});

describe('a video that is already playing', () => {
  it('is left alone', () => {
    const { calls, playhead, controller } = recording();
    playhead.isPlayingNow = true;

    controller.replay(2, 3);

    expect(calls).toEqual([]);
  });

  it('is left alone even where the stretch asked for surrounds the playhead', () => {
    const { calls, playhead, controller } = recording();
    playhead.isPlayingNow = true;
    playhead.atSec = 2.5;

    controller.replay(2, 3);

    expect(calls).toEqual([]);
  });

  it('is taken over when it is a replay of its own still running', () => {
    const { calls, playhead, controller } = recording();

    controller.replay(2, 3);
    playhead.isPlayingNow = true;
    playhead.atSec = 2.4;
    calls.length = 0;
    controller.replay(5, 6);

    expect(calls).toContain('seek:5');
  });

  it('is left alone once its own replay has run past the stretch it bounded', () => {
    const { calls, playhead, controller } = recording();

    controller.replay(2, 3);
    playhead.isPlayingNow = true;
    playhead.atSec = 3;
    calls.length = 0;
    controller.replay(5, 6);

    expect(calls).toEqual([]);
  });

  it('is available again once it has come to rest', () => {
    const { calls, playhead, controller } = recording();
    playhead.isPlayingNow = true;
    controller.replay(2, 3);
    playhead.isPlayingNow = false;
    calls.length = 0;

    controller.replay(2, 3);

    expect(calls).toContain('seek:2');
  });
});

describe('playing a stretch through, as asked for by name', () => {
  it('takes the playhead from a video the user is playing', () => {
    const { calls, playhead, controller } = recording();
    playhead.isPlayingNow = true;
    playhead.atSec = 9;

    controller.playThrough(2, 3);

    expect(calls).toEqual(['seek:2', 'stopAt:3', 'unmute', 'play']);
  });

  it('touches nothing for a stretch that ends where it begins', () => {
    const { calls, controller } = recording();

    controller.playThrough(3, 3);

    expect(calls).toEqual([]);
  });
});
