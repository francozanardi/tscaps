import { describe, expect, it } from 'vitest';
import { AnimationFrameTimeline } from '@modules/video/animation/AnimationFrameTimeline';

/**
 * A frame shows from where the one before it ends up to its own end,
 * and the animation starts over once it runs out.
 */

describe('the frame of an animation at a moment', () => {
  const timeline = new AnimationFrameTimeline([0.5, 0.25, 1]);

  it('lasts as long as the frames together', () => {
    expect(timeline.durationSec).toBe(1.75);
    expect(timeline.frameCount).toBe(3);
  });

  it('shows a frame up to its end and the next one from there', () => {
    expect([0, 0.49, 0.5, 0.74, 0.75, 1.74].map((sec) => timeline.frameIndexAt(sec))).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('starts over once it runs out', () => {
    expect([1.75, 2.3, 17.5 + 0.6].map((sec) => timeline.frameIndexAt(sec))).toEqual([0, 1, 1]);
  });

  it('shows the first frame before it starts', () => {
    expect(timeline.frameIndexAt(-3)).toBe(0);
  });

  it('holds its last frame once it has run as many times as it runs', () => {
    const twice = new AnimationFrameTimeline([0.5, 0.25, 1], 2);

    expect([1.8, 3.4, 3.5, 60].map((sec) => twice.frameIndexAt(sec))).toEqual([0, 2, 2, 2]);
  });

  it('skips a frame that lasts nothing', () => {
    expect(new AnimationFrameTimeline([0.1, 0, 0.1]).frameIndexAt(0.1)).toBe(2);
  });
});
