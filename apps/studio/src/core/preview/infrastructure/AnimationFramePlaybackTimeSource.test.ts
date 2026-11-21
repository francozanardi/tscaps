import { describe, expect, it } from 'vitest';
import type { PlaybackTimeSource } from '@core/preview/domain/PlaybackTimeSource';
import { AnimationFramePlaybackTimeSource } from '@core/preview/infrastructure/AnimationFramePlaybackTimeSource';

/** A clock the test moves by hand. */
class HandMovedClock implements PlaybackTimeSource {
  running = true;
  outputSec = 0;

  isRunning(): boolean {
    return this.running;
  }

  currentOutputTimeSec(): number {
    return this.outputSec;
  }
}

/** The animation frames, begun by hand: its `currentTime` is the frame under way. */
class HandBegunFrames {
  currentTime: number | null = 0;

  beginNext(): void {
    this.currentTime = (this.currentTime ?? 0) + 16;
  }
}

function playing(): { clock: HandMovedClock; frames: HandBegunFrames; time: AnimationFramePlaybackTimeSource } {
  const clock = new HandMovedClock();
  const frames = new HandBegunFrames();
  return { clock, frames, time: new AnimationFramePlaybackTimeSource(clock, frames as unknown as AnimationTimeline) };
}

describe('the playback time read once per animation frame', () => {
  it('answers every reading within one frame with the frame\'s first, while playing', () => {
    const { clock, time } = playing();
    clock.outputSec = 2;

    const first = time.currentOutputTimeSec();
    clock.outputSec = 2.004;
    const second = time.currentOutputTimeSec();

    expect(first).toBe(2);
    expect(second).toBe(2);
  });

  it('reads the clock again once the next frame begins', () => {
    const { clock, frames, time } = playing();
    clock.outputSec = 2;
    time.currentOutputTimeSec();

    clock.outputSec = 2.016;
    frames.beginNext();

    expect(time.currentOutputTimeSec()).toBe(2.016);
  });

  it('answers a seek within the frame at once: the clock jumping further than a frame lasts', () => {
    const { clock, time } = playing();
    clock.outputSec = 2;
    time.currentOutputTimeSec();

    clock.outputSec = 9;

    expect(time.currentOutputTimeSec()).toBe(9);
  });

  it('reads the clock live while playback stands still', () => {
    const { clock, time } = playing();
    clock.running = false;
    clock.outputSec = 2;
    time.currentOutputTimeSec();

    clock.outputSec = 2.004;

    expect(time.currentOutputTimeSec()).toBe(2.004);
    expect(time.isRunning()).toBe(false);
  });

  it('reads the clock live where the document has no frame to tell apart', () => {
    const { clock, frames, time } = playing();
    frames.currentTime = null;
    clock.outputSec = 2;
    time.currentOutputTimeSec();

    clock.outputSec = 2.004;

    expect(time.currentOutputTimeSec()).toBe(2.004);
  });
});
