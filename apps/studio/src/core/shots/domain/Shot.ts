import type { ShotFollow } from '@core/shots/domain/ShotFollow';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import type { ShotTransition } from '@core/shots/domain/ShotTransition';

/**
 * One stretch of footage, named by where it opens. It runs until the
 * next shot opens, so only its start is ever stored.
 *
 * `startSec` is source time, the space cuts and playback live in.
 * `id` is minted once and never derived from anything that moves, so
 * what is attached to a shot survives a retime, a text edit and a
 * template swap.
 */
export interface Shot {
  readonly id: string;
  readonly startSec: number;
  /** What is drawn on the frame for this shot, bottom to top. */
  readonly layers: ReadonlyArray<ShotLayer>;
  /**
   * The last shot this shot's own video is drawn over, where that is a
   * shot after this one: its camera, its framing and its CSS then run on
   * as one over every shot from this one to that one, which draw no
   * video of their own. Absent for a shot whose video ends with it. A
   * partition holds one only for a shot whose video has a style, and
   * never over a shot whose video has its own.
   */
  readonly videoThroughShotId?: string;
  /**
   * The person this shot's own camera follows, where it follows one:
   * its video is then drawn as following them, over its whole run.
   */
  readonly follow?: ShotFollow;
  /**
   * How the picture passes into this shot from the one before it;
   * absent for a plain cut. The first shot has nothing before it, so
   * it never has one.
   */
  readonly transition?: ShotTransition;
}
