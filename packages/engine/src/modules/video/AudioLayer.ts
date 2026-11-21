import type { TimeRange } from '@modules/video/RenderTimeMap';

/**
 * Stretches of output time over which a layer is lowered. Ranges that
 * come closer than `attackSec + releaseSec` are held down between them
 * rather than let back up for a moment.
 */
export interface AudioDuck {
  /** Output time; unordered, may overlap. */
  readonly ranges: ReadonlyArray<TimeRange>;
  /** Linear gain applied over each range, multiplied with the layer's own. */
  readonly gain: number;
  /** Length of the ramp down, which finishes at a range's start. */
  readonly attackSec: number;
  /** Length of the ramp back up, which starts at a range's end. */
  readonly releaseSec: number;
}

/**
 * A sound mixed into the output over a stretch of output time.
 *
 * Timing: from `outputStartSec` the source plays from `sourceStartSec`,
 * starting over from there every `sourcePassSec`; `Infinity`, or a pass
 * that is not positive, plays it once. A pass longer than what is left of the source is silent for the
 * rest of the pass. The layer stops at `outputEndSec`, at the output's
 * end, or, when it plays once, where its source runs out, whichever
 * comes first. Output time is the output timeline, after any skipped
 * ranges have collapsed.
 *
 * Fades and the duck shape the gain over that stretch; the fade out
 * lands on the layer's end. How the gain is shaped is answered by
 * `AudioGainEnvelope`.
 */
export interface AudioLayer {
  /** Names the layer in errors; unique within one mix. */
  readonly id: string;
  /** An audio file, or a video file whose primary audio track is used. */
  readonly source: Blob;
  readonly outputStartSec: number;
  /** `Infinity`: until the source or the output ends. */
  readonly outputEndSec: number;
  readonly sourceStartSec: number;
  readonly sourcePassSec: number;
  /** Linear. */
  readonly gain: number;
  readonly fadeInSec: number;
  readonly fadeOutSec: number;
  readonly duck: AudioDuck | null;
}
