import type { PlaybackTimeSource } from '@core/preview/domain/PlaybackTimeSource';

// A seek moves the playhead further than this; the clock running on its own, within one frame, never does.
const LONGEST_FRAME_SEC = 0.25;

/**
 * {@link PlaybackTimeSource} that answers one time for the whole of an
 * animation frame while playback runs: the first reading in a frame is
 * the frame's time, and every later reading in it gets the same one.
 *
 * Everything that draws or publishes a frame then names the same
 * moment, to the last digit, however many milliseconds apart within the
 * frame each one asks. A clock read live gives each of them a moment of
 * its own, and whatever is worked out per moment is worked out once for
 * each.
 *
 * While playback stands still the time is read live, so a seek shows at
 * once; while it runs, a jump of more than a frame can last is a seek
 * and is taken at once too.
 */
export class AnimationFramePlaybackTimeSource implements PlaybackTimeSource {
  private heldFrame: AnimationTimeline['currentTime'] = null;
  private heldOutputSec = 0;

  /** `frames` tells one animation frame from the next: its `currentTime` is the same for every reading within a frame. */
  constructor(
    private readonly live: PlaybackTimeSource,
    private readonly frames: AnimationTimeline,
  ) {}

  isRunning(): boolean {
    return this.live.isRunning();
  }

  currentOutputTimeSec(): number {
    const liveSec = this.live.currentOutputTimeSec();
    if (!this.live.isRunning()) return liveSec;
    const frame = this.frames.currentTime;
    const sameFrame = frame !== null && frame === this.heldFrame;
    if (sameFrame && Math.abs(liveSec - this.heldOutputSec) < LONGEST_FRAME_SEC) return this.heldOutputSec;
    this.heldFrame = frame;
    this.heldOutputSec = liveSec;
    return liveSec;
  }
}
