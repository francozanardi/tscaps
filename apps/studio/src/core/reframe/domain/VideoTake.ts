/**
 * A stretch of the source video filmed in one go: from one of its own
 * picture changes (an edit already in it, a switch of camera) to the
 * next, in seconds of the source. `index` counts the takes from 0.
 */
export interface VideoTake {
  readonly index: number;
  readonly startSec: number;
  readonly endSec: number;
}
