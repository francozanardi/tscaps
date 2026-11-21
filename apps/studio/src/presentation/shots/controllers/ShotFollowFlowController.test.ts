import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FollowPersonOnShotInput } from '@core/shots/actions/FollowPersonOnShotAction';
import type { PeopleAtMoment } from '@core/subject-tracking/domain/PeopleAtMoment';
import type { PersonSighting } from '@core/subject-tracking/domain/PersonSighting';
import { ShotFollowFlowController, type PeopleFinder, type ShotPersonFollower } from '@presentation/shots/controllers/ShotFollowFlowController';

/** A person whose head is at `x` across the picture. */
function personAt(x: number): PersonSighting {
  return { box: { minX: x - 0.05, minY: 0.1, maxX: x + 0.05, maxY: 0.9 }, head: { x, y: 0.2 }, source: 'pose', headHeight: 0.1 };
}

/** Finds, at each moment it is asked about, the people listed for it; nobody at the others. */
class ListedPeopleFinder implements PeopleFinder {
  readonly asked: number[][] = [];

  constructor(private readonly byMoment: ReadonlyMap<number, ReadonlyArray<PersonSighting>>) {}

  async execute(moments: ReadonlyArray<number>): Promise<PeopleAtMoment | null> {
    this.asked.push([...moments]);
    for (const sourceSec of moments) {
      const people = this.byMoment.get(sourceSec) ?? [];
      if (people.length > 0) return { sourceSec, people };
    }
    return null;
  }
}

/** Follows whoever it is asked to, unless told nobody is there; or waits, until let go, for a follow to be stopped. */
class RecordingFollower implements ShotPersonFollower {
  readonly asked: FollowPersonOnShotInput[] = [];
  private release: (() => void) | null = null;

  constructor(private readonly outcome: 'followed' | 'nobody' | 'waits' | 'fails' = 'followed') {}

  async execute(input: FollowPersonOnShotInput): Promise<boolean> {
    this.asked.push(input);
    input.onProgress(0.5);
    if (this.outcome === 'fails') throw new Error('The video cannot be decoded.');
    if (this.outcome === 'waits') await new Promise<void>((resolve) => { this.release = resolve; });
    return this.outcome !== 'nobody';
  }

  letGo(): void {
    this.release?.();
  }
}

/** Finds nobody, each time only once let go, as a look on a slow device does. */
class WaitingFinder implements PeopleFinder {
  private release: (() => void) | null = null;

  async execute(): Promise<PeopleAtMoment | null> {
    await new Promise<void>((resolve) => { this.release = resolve; });
    return null;
  }

  letGo(): void {
    this.release?.();
  }
}

const POSTER = 2.1;
const START = 2.02;
const END = 7.98;

function flowWith(byMoment: ReadonlyMap<number, ReadonlyArray<PersonSighting>>, follower = new RecordingFollower()) {
  const finder = new ListedPeopleFinder(byMoment);
  const flow = new ShotFollowFlowController('shot', finder, follower);
  const phases: string[] = [];
  flow.addEventListener('change', () => phases.push(flow.snapshot().phase));
  return { flow, finder, follower, phases };
}

describe('picking a person for a shot to follow', () => {
  it('follows the one person found without asking who, from the frame they were found in', async () => {
    const { flow, follower, phases } = flowWith(new Map([[POSTER, [personAt(0.4)]]]));

    await flow.start([POSTER, START, END]);

    expect(follower.asked.map(({ shotId, frame, chosen }) => ({ shotId, sourceSec: frame.sourceSec, person: frame.people[chosen]!.head }))).toEqual([
      { shotId: 'shot', sourceSec: POSTER, person: { x: 0.4, y: 0.2 } },
    ]);
    expect(phases).toEqual(['looking', 'following', 'following', 'idle']);
  });

  it('offers the several people found, and follows the one picked', async () => {
    const { flow, follower } = flowWith(new Map([[POSTER, [personAt(0.3), personAt(0.7)]]]));

    await flow.start([POSTER, START, END]);
    const offered = flow.snapshot();
    expect(offered.phase).toBe('choosing');
    expect(follower.asked).toEqual([]);

    await flow.choose(offered.phase === 'choosing' ? offered.frame : { sourceSec: 0, people: [] }, 1);

    expect(follower.asked[0]!.frame.sourceSec).toBe(POSTER);
    expect(follower.asked[0]!.frame.people[follower.asked[0]!.chosen]!.head).toEqual({ x: 0.7, y: 0.2 });
    expect(flow.snapshot()).toEqual({ phase: 'idle' });
  });

  it('follows someone else picked straight away on the frame a follow was picked on, without looking again', async () => {
    const { flow, finder, follower } = flowWith(new Map());
    const picked = { sourceSec: START, people: [personAt(0.3), personAt(0.7)] };

    await flow.choose(picked, 0);

    expect(finder.asked).toEqual([]);
    expect(follower.asked[0]!.frame).toEqual(picked);
    expect(follower.asked[0]!.chosen).toBe(0);
  });

  it('looks at the shot\'s start and end where nobody is in the frame shown', async () => {
    const { flow, finder, follower } = flowWith(new Map([[END, [personAt(0.6)]]]));

    await flow.start([POSTER, START, END]);

    expect(finder.asked).toEqual([[POSTER, START, END]]);
    expect(follower.asked[0]!.frame.sourceSec).toBe(END);
  });

  it('says so where nobody is found in the shot', async () => {
    const { flow, follower } = flowWith(new Map());

    await flow.start([POSTER, START, END]);

    expect(flow.snapshot()).toEqual({ phase: 'nobody' });
    expect(follower.asked).toEqual([]);
  });

  it('says so where the person picked cannot be followed', async () => {
    const { flow } = flowWith(new Map([[POSTER, [personAt(0.4)]]]), new RecordingFollower('nobody'));

    await flow.start([POSTER]);

    expect(flow.snapshot()).toEqual({ phase: 'nobody' });
  });

  it('stops following when cancelled, and keeps nothing of the follow under way', async () => {
    const follower = new RecordingFollower('waits');
    const { flow } = flowWith(new Map([[POSTER, [personAt(0.4)]]]), follower);

    const started = flow.start([POSTER]);
    await Promise.resolve();
    await Promise.resolve();
    expect(flow.snapshot()).toMatchObject({ phase: 'following', chosen: 0, fraction: 0.5 });
    flow.cancel();
    follower.letGo();
    await started;

    expect(follower.asked[0]!.signal.aborted).toBe(true);
    expect(flow.snapshot()).toEqual({ phase: 'idle' });
  });

  it('says it failed where the video or the detector fails', async () => {
    const { flow } = flowWith(new Map([[POSTER, [personAt(0.4)]]]), new RecordingFollower('fails'));

    await flow.start([POSTER]);

    expect(flow.snapshot()).toEqual({ phase: 'failed' });
  });
});

describe('saying that people are being looked for', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('says it only once the look has lasted, leaving what was shown before in view until then', async () => {
    vi.useFakeTimers();
    const finder = new WaitingFinder();
    const flow = new ShotFollowFlowController('shot', finder, new RecordingFollower());
    const first = flow.start([POSTER]);
    await Promise.resolve();
    finder.letGo();
    await first;
    expect(flow.snapshot()).toEqual({ phase: 'nobody' });

    const looking = flow.start([POSTER]);
    vi.advanceTimersByTime(399);
    expect(flow.snapshot()).toEqual({ phase: 'looking', said: false, before: { phase: 'nobody' } });
    vi.advanceTimersByTime(1);
    expect(flow.snapshot()).toMatchObject({ phase: 'looking', said: true });
    finder.letGo();
    await looking;

    expect(flow.snapshot()).toEqual({ phase: 'nobody' });
  });

  it('never says a look that ends at once, so its answer replaces what was shown outright', async () => {
    vi.useFakeTimers();
    const { flow } = flowWith(new Map());
    const seen: unknown[] = [];
    flow.addEventListener('change', () => seen.push(flow.snapshot()));

    await flow.start([POSTER]);
    vi.advanceTimersByTime(1000);

    expect(seen).toEqual([{ phase: 'looking', said: false, before: { phase: 'idle' } }, { phase: 'nobody' }]);
  });
});
