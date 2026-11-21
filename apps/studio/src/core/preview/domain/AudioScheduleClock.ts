import type { PlaybackTimeSource } from '@core/preview/domain/PlaybackTimeSource';

/**
 * Where moments of the output timeline fall on an `AudioContext`'s
 * timeline, so sound can be scheduled to land on them.
 */
export interface AudioScheduleClock extends PlaybackTimeSource {
  /** Output seconds per second of the audio context's timeline. */
  getRate(): number;

  /**
   * The audio context's time at which `outputSec` plays while playback
   * runs, under the rate as it stands; while it does not run, the
   * context's current time.
   */
  audioContextTimeForOutputTime(outputSec: number): number;
}
