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
export interface PlaybackClock {
  play(fromOutputSec: number): void;
  pause(): void;
  seek(toOutputSec: number): void;
  setRate(rate: number): void;

  isRunning(): boolean;
  getRate(): number;
  currentOutputTimeSec(): number;

  /**
   * Returns the audio-rendering timeline value at which the given
   * output time will arrive under the current anchor and rate. The
   * returned value is in the same units the audio scheduler reads
   * for absolute-time scheduling.
   */
  audioContextTimeForOutputTime(outputSec: number): number;
}
