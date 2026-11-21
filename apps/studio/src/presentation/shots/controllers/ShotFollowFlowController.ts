import type { PeopleAtMoment } from '@core/subject-tracking/domain/PeopleAtMoment';
import type { FollowPersonOnShotInput } from '@core/shots/actions/FollowPersonOnShotAction';

// A look for people is said only once it has lasted this long; on a fast device it ends at once, and saying it would
// flash a line and a Cancel button in and straight out before the answer.
const LOOKING_SAID_AFTER_MS = 400;

/** Finds who is at the first of a few moments of the video in which anyone is. */
export interface PeopleFinder {
  execute(moments: ReadonlyArray<number>, signal: AbortSignal): Promise<PeopleAtMoment | null>;
}

/** Has a shot follow the person picked on it; false where nobody is at the pick. */
export interface ShotPersonFollower {
  execute(input: FollowPersonOnShotInput): Promise<boolean>;
}

/**
 * Where picking someone to follow on a shot has got: nothing under way;
 * looking for people, `said` once the look has lasted long enough to be
 * shown and, until then, `before` the state it started from, which a
 * look that ends at once leaves in view; several found, waiting for one to be picked on the
 * frame they were found in; following the one picked (`chosen`, an index
 * into `frame.people`), `fraction` of the way; nobody found; or a failure
 * of the video or the detector.
 */
export type ShotFollowFlowState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'looking'; readonly said: boolean; readonly before: ShotFollowFlowState }
  | { readonly phase: 'choosing'; readonly frame: PeopleAtMoment }
  | { readonly phase: 'following'; readonly frame: PeopleAtMoment; readonly chosen: number; readonly fraction: number }
  | { readonly phase: 'nobody' }
  | { readonly phase: 'failed' };

/**
 * Drives picking a person for one shot's camera to follow: looks for
 * people at the moments asked (the frame shown, then the shot's start
 * and end), follows the one person found without asking, or waits for
 * one of several to be picked, then follows them through the shot. A
 * person can also be picked straight away on a frame already known, the
 * one a shot's follow was picked on. Announces every change of state as
 * `change`. Asking again, picking or cancelling stops whatever is under
 * way; `stop` does too, for good.
 */
export class ShotFollowFlowController extends EventTarget {
  private state: ShotFollowFlowState = { phase: 'idle' };
  private running: AbortController | null = null;
  private saying: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly shotId: string,
    private readonly finder: PeopleFinder,
    private readonly follower: ShotPersonFollower,
  ) {
    super();
  }

  snapshot(): ShotFollowFlowState {
    return this.state;
  }

  /**
   * Looks for people at `moments`, in order, and follows the one found,
   * or offers the several found. The look is `said` only once it has
   * lasted 400 ms: on a fast device it ends at once.
   */
  async start(moments: ReadonlyArray<number>): Promise<void> {
    const before = this.state.phase === 'looking' ? this.state.before : this.state;
    const signal = this.begin({ phase: 'looking', said: false, before });
    this.saying = setTimeout(() => {
      this.saying = null;
      if (!signal.aborted && this.state.phase === 'looking') this.set({ phase: 'looking', said: true, before });
    }, LOOKING_SAID_AFTER_MS);
    try {
      const found = await this.finder.execute(moments, signal);
      if (signal.aborted) return;
      if (found === null) this.set({ phase: 'nobody' });
      else if (found.people.length === 1) await this.follow(found, 0, signal);
      else this.set({ phase: 'choosing', frame: found });
    } catch (error) {
      this.settleFailure(signal, error);
    }
  }

  /** Follows the person `chosen` (an index into `frame.people`) of the people seen in `frame`. */
  async choose(frame: PeopleAtMoment, chosen: number): Promise<void> {
    const signal = this.begin({ phase: 'following', frame, chosen, fraction: 0 });
    try {
      await this.follow(frame, chosen, signal);
    } catch (error) {
      this.settleFailure(signal, error);
    }
  }

  /** Stops whatever is under way and goes back to nothing asked. */
  cancel(): void {
    this.stop();
    this.set({ phase: 'idle' });
  }

  /** Stops whatever is under way without announcing it, for an owner that is going away. */
  stop(): void {
    this.running?.abort();
    this.running = null;
    this.stopSaying();
  }

  private async follow(frame: PeopleAtMoment, chosen: number, signal: AbortSignal): Promise<void> {
    this.set({ phase: 'following', frame, chosen, fraction: 0 });
    const followed = await this.follower.execute({
      shotId: this.shotId,
      frame,
      chosen,
      signal,
      onProgress: (fraction) => { if (!signal.aborted) this.set({ phase: 'following', frame, chosen, fraction }); },
    });
    if (signal.aborted) return;
    this.running = null;
    this.set(followed ? { phase: 'idle' } : { phase: 'nobody' });
  }

  /** Stops what was under way, enters `state`, and hands out the signal of the work that starts now. */
  private begin(state: ShotFollowFlowState): AbortSignal {
    this.stop();
    this.running = new AbortController();
    this.set(state);
    return this.running.signal;
  }

  /** A failure of work that was not stopped meanwhile; one that was stopped is not reported. */
  private settleFailure(signal: AbortSignal, error: unknown): void {
    if (signal.aborted) return;
    this.running = null;
    console.error('[follow a person]', error);
    this.set({ phase: 'failed' });
  }

  private set(state: ShotFollowFlowState): void {
    if (state.phase !== 'looking') this.stopSaying();
    this.state = state;
    this.dispatchEvent(new Event('change'));
  }

  private stopSaying(): void {
    if (this.saying !== null) clearTimeout(this.saying);
    this.saying = null;
  }
}
