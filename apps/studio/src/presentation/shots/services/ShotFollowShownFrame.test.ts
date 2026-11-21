import { describe, expect, it } from 'vitest';
import type { FollowPickFrame } from '@core/shots/domain/ShotFollow';
import { ShotFollowShownFrame } from '@presentation/shots/services/ShotFollowShownFrame';

/** The frame a shot's follow was picked on: two people, the second followed. */
const PICKED: FollowPickFrame = {
  sourceSec: 3,
  people: [
    { box: { minX: 0.2, minY: 0.1, maxX: 0.3, maxY: 0.9 }, head: { x: 0.25, y: 0.2 } },
    { box: { minX: 0.6, minY: 0.1, maxX: 0.7, maxY: 0.9 }, head: { x: 0.65, y: 0.2 } },
  ],
  chosen: 1,
};

const shownFrames = new ShotFollowShownFrame();

describe('the frame a shot\'s Follow section shows', () => {
  it('shows the camera on the frame the follow was picked on, with everyone seen there', () => {
    expect(shownFrames.of({ phase: 'idle' }, true, PICKED, 3.02)).toEqual({ frame: { sourceSec: 3, people: PICKED.people }, chosen: 1, camera: true });
  });

  it('shows the camera alone on any other frame, where nobody was looked for', () => {
    expect(shownFrames.of({ phase: 'idle' }, true, PICKED, 5)).toEqual({ frame: { sourceSec: 5, people: [] }, chosen: null, camera: true });
  });

  it('shows the camera where the follow was not picked on a frame, as the agent\'s are not', () => {
    expect(shownFrames.of({ phase: 'idle' }, true, null, 1)).toEqual({ frame: { sourceSec: 1, people: [] }, chosen: null, camera: true });
  });

  it('shows nothing while the shot follows nobody', () => {
    expect(shownFrames.of({ phase: 'nobody' }, false, null, 1)).toBeNull();
  });

  it('keeps the frame shown while people are looked for again, so the section does not jump before the answer', () => {
    for (const said of [false, true]) {
      expect(shownFrames.of({ phase: 'looking', said, before: { phase: 'idle' } }, true, PICKED, 3)?.frame.sourceSec).toBe(3);
    }
  });
});
