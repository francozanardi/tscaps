// 1 µs tolerance: absorbs IEEE-754 rounding at exact interval
// boundaries (a video frame whose timestamp matches a caption
// midpoint to the last few ULPs) without affecting any real
// sub-frame difference.
const CAPTION_BOUNDARY_EPSILON_S = 1e-6;

/**
 * The caption ticks of a render: one every `interval` seconds, tick N
 * covering `[(N-0.5)·interval, (N+0.5)·interval)` and painted for the
 * moment `N·interval`. Rounding to the nearest tick halves the
 * worst-case timing error of a floor, at the cost of a caption
 * appearing up to half an interval early.
 *
 * The one place the rule lives, so a frame painted alone lands on the
 * tick a run of frames painted in order lands on.
 */
export class CaptionTicks {

  constructor(private readonly interval: number) {}

  /**
   * The tick `time` lands on. `atLeast`, when given, is a tick already
   * known to be reached, and the answer never goes below it: a caller
   * walking forward through time passes the tick it reached last and
   * pays only for the ticks between. Without it the answer is found
   * from `time` alone, whatever was asked before.
   */
  indexAt(time: number, atLeast?: number): number {
    let index = atLeast ?? this.estimateAt(time);
    if (atLeast === undefined) {
      while (index > 0 && !this.hasPassed(index - 1, time)) index--;
    }
    while (this.hasPassed(index, time)) index++;
    return index;
  }

  /** The moment tick `index` is painted for. */
  timeOf(index: number): number {
    return index * this.interval;
  }

  /** A starting point at or near the answer, which the walk in {@link indexAt} corrects either way. */
  private estimateAt(time: number): number {
    return Math.max(0, Math.floor(time / this.interval));
  }

  /** Whether `time` lies at or past the end of what tick `index` covers. */
  private hasPassed(index: number, time: number): boolean {
    return (index + 0.5) * this.interval <= time + CAPTION_BOUNDARY_EPSILON_S;
  }
}
