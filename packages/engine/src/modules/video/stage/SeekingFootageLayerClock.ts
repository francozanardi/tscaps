import type { FootageLayer } from '@modules/video/FootageLayer';
import type { FootageLayerClock, FootageLayerClockChange } from '@modules/video/stage/FootageLayerClock';

// Animations are moved in steps of a tenth of a millisecond, the step the written clock moves in, so a
// moment lands on the same side of a keyframe or a step whichever way the box is set.
const CLOCK_STEPS_PER_SEC = 10_000;
const CLOCK_STEPS_PER_MS = 10;
// How far the clock is moved to see how each animation answers it.
const PROBE_STEP_SEC = 1;
// Timings are compared in milliseconds; the clock is written to a tenth of one.
const TIMING_TOLERANCE_MS = 0.01;

/** A box that is set by moving its animations. */
interface SoughtBox {
  /** The animations whose delay falls with the clock: the ones moved. */
  readonly followers: ReadonlyArray<Animation>;
  /** Where each of them stood in its keyframes when the box was last set; null before the first setting. */
  steps: ReadonlyArray<AnimationStep> | null;
}

/** Where an animation stands in its keyframes: how far through the run it is on, and which run; null where it has no effect. */
interface AnimationStep {
  readonly progress: number | null;
  readonly iteration: number | null;
}

/** One animation of a box and how it is timed, read at one setting of the clock. */
interface TimedAnimation {
  readonly animation: Animation;
  readonly delayMs: number;
  readonly durationMs: number | string;
}

/**
 * {@link FootageLayerClock} for a stylesheet that reads the clock only
 * to delay its animations: it writes the clock on a box once, as it
 * stands when the layer starts, and from then on moves the box's
 * animations to the moment instead. A delay that falls as time passes
 * and an animation moved forward by as much are the same thing, and
 * moving an animation leaves the rest of the box's style alone, where
 * writing the clock has the document work it all out again.
 *
 * It checks each box the first time it sets it, by moving the clock
 * and reading every animation's timing back: an animation whose delay
 * falls with the clock is moved with it, one whose delay stays is left
 * where it is, as it stays when the clock is written. A box where an
 * animation answers the clock any other way (its length changes, its
 * delay moves by another amount) is set by `variables` every time.
 *
 * Nothing but its animations changes a box set this way, so a box
 * whose animations all stand where they stood at the last setting (run
 * out, not yet begun, or between two steps) is `still`.
 */
export class SeekingFootageLayerClock implements FootageLayerClock {
  // By box: how it is sought, or null where it is set by the variables.
  private readonly soughtByBox = new WeakMap<HTMLElement, SoughtBox | null>();

  /** `variables` writes the clock for the stylesheet to read; it sets a box once here, and every time where a box cannot be sought. */
  constructor(private readonly variables: FootageLayerClock) {}

  set(box: HTMLElement, layer: FootageLayer, outputSec: number): FootageLayerClockChange {
    const sought = this.soughtBoxOf(box, layer);
    if (sought === null) return this.variables.set(box, layer, outputSec);
    const sinceStartMs = Math.round((outputSec - layer.outputStartSec) * CLOCK_STEPS_PER_SEC) / CLOCK_STEPS_PER_MS;
    for (const animation of sought.followers) animation.currentTime = sinceStartMs;
    const steps = sought.followers.map((animation) => this.stepOf(animation));
    const before = sought.steps;
    const still = before !== null && steps.every((step, index) => this.sameStep(step, before[index]!));
    sought.steps = steps;
    return still ? 'still' : 'moved';
  }

  private soughtBoxOf(box: HTMLElement, layer: FootageLayer): SoughtBox | null {
    const known = this.soughtByBox.get(box);
    if (known !== undefined) return known;
    const followers = this.probed(box, layer);
    const sought = followers === null ? null : { followers, steps: null };
    this.soughtByBox.set(box, sought);
    return sought;
  }

  private stepOf(animation: Animation): AnimationStep {
    const timing = animation.effect?.getComputedTiming();
    return { progress: timing?.progress ?? null, iteration: timing?.currentIteration ?? null };
  }

  private sameStep(first: AnimationStep, second: AnimationStep): boolean {
    return first.progress === second.progress && first.iteration === second.iteration;
  }

  /**
   * Leaves the clock written as it stands at the layer's start, and
   * answers the animations whose delay fell as the clock moved; null
   * where any animation took the clock some other way.
   */
  private probed(box: HTMLElement, layer: FootageLayer): ReadonlyArray<Animation> | null {
    this.variables.set(box, layer, layer.outputStartSec + PROBE_STEP_SEC);
    const later = this.timedAnimationsOf(box);
    this.variables.set(box, layer, layer.outputStartSec);
    const atStart = this.timedAnimationsOf(box);
    if (later === null || atStart === null || later.length !== atStart.length) return null;
    const followers: Animation[] = [];
    for (const [index, timed] of atStart.entries()) {
      const moved = later[index]!;
      if (moved.animation !== timed.animation || !this.sameDuration(moved, timed)) return null;
      const delayFellByMs = timed.delayMs - moved.delayMs;
      if (Math.abs(delayFellByMs - PROBE_STEP_SEC * 1000) <= TIMING_TOLERANCE_MS) followers.push(timed.animation);
      else if (Math.abs(delayFellByMs) > TIMING_TOLERANCE_MS) return null;
    }
    return followers;
  }

  /** The box's animations with their timing as the document computes it now; null where one has no timing to read. */
  private timedAnimationsOf(box: HTMLElement): TimedAnimation[] | null {
    const timed: TimedAnimation[] = [];
    for (const animation of box.getAnimations()) {
      const timing = animation.effect?.getComputedTiming();
      if (timing === undefined || timing.delay === undefined || timing.duration === undefined) return null;
      timed.push({ animation, delayMs: timing.delay, durationMs: this.durationOf(timing.duration) });
    }
    return timed;
  }

  private durationOf(duration: string | number | CSSNumericValue): number | string {
    return typeof duration === 'number' || typeof duration === 'string' ? duration : duration.toString();
  }

  private sameDuration(first: TimedAnimation, second: TimedAnimation): boolean {
    if (typeof first.durationMs === 'number' && typeof second.durationMs === 'number') {
      return Math.abs(first.durationMs - second.durationMs) <= TIMING_TOLERANCE_MS;
    }
    return first.durationMs === second.durationMs;
  }
}
