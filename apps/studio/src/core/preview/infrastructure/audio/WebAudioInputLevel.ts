import { type AudioDuck } from '@tscaps/engine';
import { AudioGainEnvelope } from '@tscaps/engine/advanced';
import type { AudioScheduleClock } from '@core/preview/domain/AudioScheduleClock';

/** The parameter a level drives while mounted, and the clock it follows. */
interface MountedLevel {
  readonly context: BaseAudioContext;
  readonly param: AudioParam;
  readonly clock: AudioScheduleClock;
}

/**
 * Drives the gain parameter of a video's own sound along the curve the
 * export applies to it ({@link AudioGainEnvelope.forInput}): its level,
 * changed over the stretches asked for. While playback runs, every
 * corner of the curve ahead of the clock is scheduled as a linear ramp
 * where it lands on the audio context's timeline; while it does not,
 * the parameter holds the value at the clock's moment.
 *
 * The level and its stretches are kept across mounts.
 */
export class WebAudioInputLevel {
  private mounted: MountedLevel | null = null;
  private envelope = AudioGainEnvelope.forInput(1, [], Number.POSITIVE_INFINITY);
  private following = false;

  /** Drives `param`, timed by `clock`; a later call moves it there. Holds still until {@link followFrom}. */
  mount(context: BaseAudioContext, param: AudioParam, clock: AudioScheduleClock): void {
    this.following = false;
    this.mounted = { context, param, clock };
    this.hold();
  }

  /** Lets go of the parameter, leaving it where it is. */
  unmount(): void {
    this.following = false;
    this.mounted = null;
  }

  /** Takes a new level, shaped over each of `ducks`' ranges, heard from the clock's moment on. */
  set(gain: number, ducks: ReadonlyArray<AudioDuck>, outputDurationSec: number): void {
    this.envelope = AudioGainEnvelope.forInput(Math.max(0, gain), ducks, outputDurationSec);
    if (this.following && this.mounted !== null) this.scheduleFrom(this.mounted, this.mounted.clock.currentOutputTimeSec());
    else this.hold();
  }

  /** Follows the curve from `outputSec`, which the clock has just been set to and is running from. */
  followFrom(outputSec: number): void {
    if (this.mounted === null) return;
    this.following = true;
    this.scheduleFrom(this.mounted, outputSec);
  }

  /** Stops following the clock, holding the value at its moment. */
  stop(): void {
    this.following = false;
    this.hold();
  }

  private hold(): void {
    const mounted = this.mounted;
    if (mounted === null) return;
    const now = mounted.context.currentTime;
    mounted.param.cancelScheduledValues(now);
    mounted.param.setValueAtTime(this.envelope.gainAt(mounted.clock.currentOutputTimeSec()), now);
  }

  private scheduleFrom(mounted: MountedLevel, fromSec: number): void {
    const { context, param, clock } = mounted;
    const now = context.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(this.envelope.gainAt(fromSec), Math.max(now, clock.audioContextTimeForOutputTime(fromSec)));
    let previousSec = fromSec;
    for (const point of this.envelope.breakpoints) {
      if (point.timeSec <= fromSec) continue;
      if (!Number.isFinite(point.timeSec)) break;
      const at = clock.audioContextTimeForOutputTime(point.timeSec);
      // Two breakpoints at one moment are a step, not a ramp.
      if (point.timeSec === previousSec) param.setValueAtTime(point.gain, at);
      else param.linearRampToValueAtTime(point.gain, at);
      previousSec = point.timeSec;
    }
  }
}
