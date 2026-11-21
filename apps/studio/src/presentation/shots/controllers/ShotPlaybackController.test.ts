import { describe, expect, it } from 'vitest';
import { ShotPlaybackController } from '@presentation/shots/controllers/ShotPlaybackController';

/**
 * Playing a shot hands the surface a bound it must not lose, and must
 * leave the playhead inside the shot it played — the highlighted card
 * is whichever shot the playhead rests in.
 */

function recording() {
  const calls: string[] = [];
  const stops: number[] = [];
  const controller = new ShotPlaybackController(
    (timeSec) => calls.push(`seek:${timeSec}`),
    () => calls.push('play'),
    (timeSec) => {
      calls.push('stopAt');
      stops.push(timeSec);
    },
    () => calls.push('unmute'),
  );
  return { calls, stops, controller };
}

describe('playing a shot', () => {
  it('asks for its stop after the seek that would have dropped it', () => {
    const { calls, controller } = recording();

    controller.playShot(2, 5);

    expect(calls.indexOf('seek:2')).toBeLessThan(calls.indexOf('stopAt'));
    expect(calls.indexOf('stopAt')).toBeLessThan(calls.indexOf('play'));
  });

  it('rests inside the shot, never where the next one opens', () => {
    const { stops, controller } = recording();

    controller.playShot(2, 5);

    expect(stops[0]).toBeGreaterThan(2);
    expect(stops[0]).toBeLessThan(5);
  });

  it('plays aloud even where a silent replay left a mute standing', () => {
    const { calls, controller } = recording();

    controller.playShot(2, 5);

    expect(calls.indexOf('unmute')).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf('unmute')).toBeLessThan(calls.indexOf('play'));
  });
});
