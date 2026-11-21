import type { AudioScheduleClock } from '@core/preview/domain/AudioScheduleClock';

/**
 * Output-time clock that drives audio and video scheduling for the
 * preview surface. Tracks playback position as the conceptual
 * "output time" — what the viewer perceives after cuts collapse —
 * and exposes the conversion to the underlying audio-rendering
 * timeline so audio nodes can be scheduled with sample accuracy.
 *
 * When paused, the clock freezes at its last reading. `play` and
 * `seek` re-anchor it. Rate changes preserve the current output
 * position so the surface advances continuously across rate flips.
 */
export interface PlaybackClock extends AudioScheduleClock {
  play(fromOutputSec: number): void;
  pause(): void;
  seek(toOutputSec: number): void;
  setRate(rate: number): void;
}
