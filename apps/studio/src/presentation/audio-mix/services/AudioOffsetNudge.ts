import type { AudioAnchorPoint } from '@core/audio-mix/domain/AudioAnchorPoint';
import { AudioMixSanitizer } from '@core/audio-mix/domain/AudioMixSanitizer';

const STEP_SEC = 0.05;
// An effect sits on or near what it is placed against; a second either way is room enough to fix its timing.
const MAX_NEAR_SEC = 1;

/** The offsets a control may set on an effect placed against something on the edit, and its step. */
export interface AudioOffsetBounds {
  readonly minSec: number;
  readonly maxSec: number;
  readonly stepSec: number;
}

/**
 * Moves an effect a little earlier or later than what it is placed
 * against, in steps of a twentieth of a second, and says how far it is.
 *
 * Placed against something on the edit, it moves at most a second
 * either way. Placed against the video's start or end, which is where an
 * effect lands when nothing nearer exists, it moves as far as an offset
 * may go. One already further out than its limit moves back toward its
 * anchor and never further away.
 */
export class AudioOffsetNudge {
  /** The offset of `point` moved by `steps` (negative is earlier), rounded to the step; the same where it cannot move. */
  nudged(point: AudioAnchorPoint, steps: number): number {
    const limit = point.anchor.kind === 'video' ? AudioMixSanitizer.MAX_OFFSET_SEC : MAX_NEAR_SEC;
    const moved = Number((Math.round((point.offsetSec + steps * STEP_SEC) / STEP_SEC) * STEP_SEC).toFixed(2));
    if (Math.abs(moved) <= limit || Math.abs(moved) < Math.abs(point.offsetSec)) return moved;
    return Math.abs(point.offsetSec) >= limit ? point.offsetSec : Math.sign(moved) * limit;
  }

  /** The offsets an effect placed against something on the edit may take. */
  nearBounds(): AudioOffsetBounds {
    return { minSec: -MAX_NEAR_SEC, maxSec: MAX_NEAR_SEC, stepSec: STEP_SEC };
  }

  /** Whether `point` can move by `steps`. */
  canNudge(point: AudioAnchorPoint, steps: number): boolean {
    return this.nudged(point, steps) !== point.offsetSec;
  }

  /** How far from its anchor an effect plays: `0.00s`, `+0.10s`, `−0.05s`. */
  labelOf(offsetSec: number): string {
    const rounded = Math.round(offsetSec * 100) / 100;
    if (rounded === 0) return '0.00s';
    return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(2)}s`;
  }
}
