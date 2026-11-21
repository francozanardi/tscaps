// Times are counted in whole microseconds, so that durations given in
// decimal seconds add up exactly: 0.1 + 0.3 + 0.2 is not 0.6 in floating
// point, and a moment at 0.6 would land on the last frame, not the first.
const MICROSECONDS_PER_SECOND = 1_000_000;

/**
 * Which frame of an animation shows at a moment, from how long each
 * frame lasts and how many times it runs. It starts over each time it
 * runs out, as many times as it runs, then holds its last frame, so any
 * moment from its start answers a frame.
 *
 * Every reader of an animation asks here — the one drawing it into a
 * file and the one playing it on screen — so both show the same frame
 * for the same moment.
 */
export class AnimationFrameTimeline {
  /** Where each frame ends, in microseconds from the start of one run of the animation. */
  private readonly frameEndsUs: readonly number[];

  /**
   * `frameDurationsSec` holds one entry per frame, in order; a negative
   * or non-finite one counts as zero. `playCount` is how many times it
   * runs, `Infinity` (the default) for ever; anything under one runs once.
   */
  constructor(
    frameDurationsSec: ReadonlyArray<number>,
    private readonly playCount: number = Infinity,
  ) {
    let elapsedUs = 0;
    this.frameEndsUs = frameDurationsSec.map((durationSec) => {
      elapsedUs += Number.isFinite(durationSec) && durationSec > 0 ? this.microseconds(durationSec) : 0;
      return elapsedUs;
    });
  }

  get frameCount(): number {
    return this.frameEndsUs.length;
  }

  /** How long one run of the animation lasts. */
  get durationSec(): number {
    return (this.frameEndsUs.at(-1) ?? 0) / MICROSECONDS_PER_SECOND;
  }

  /**
   * The index of the frame showing `elapsedSec` after the animation
   * first started. A frame shows from where the one before it ends up to
   * where it ends, its end excluded. A moment before the start answers
   * the first frame, and so does every moment of an animation that
   * lasts nothing; a moment after its last run answers the last frame.
   */
  frameIndexAt(elapsedSec: number): number {
    const durationUs = this.frameEndsUs.at(-1) ?? 0;
    if (!(durationUs > 0) || !(elapsedSec > 0)) return 0;
    const elapsedUs = this.microseconds(elapsedSec);
    if (elapsedUs >= durationUs * Math.max(1, this.playCount)) return this.frameEndsUs.length - 1;
    const intoRunUs = elapsedUs % durationUs;
    let low = 0;
    let high = this.frameEndsUs.length - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (this.frameEndsUs[middle]! > intoRunUs) high = middle;
      else low = middle + 1;
    }
    return low;
  }

  private microseconds(sec: number): number {
    return Math.round(sec * MICROSECONDS_PER_SECOND);
  }
}
