import { describe, expect, it } from 'vitest';
import type { FramingPart } from '@core/reframe/domain/FramingPart';
import { PartMoments } from '@core/reframe/services/PartMoments';
import { ReframePartFollower, type PeopleFinder, type PersonFollowPlanning } from '@core/reframe/services/ReframePartFollower';
import { EditorStore } from '@core/editor/store/EditorStore';
import type { PlanPersonFollowInput } from '@core/subject-tracking/actions/PlanPersonFollowAction';
import type { PeopleAtMoment } from '@core/subject-tracking/domain/PeopleAtMoment';
import type { PersonFollow } from '@core/subject-tracking/domain/PersonFollow';
import type { SeenPerson } from '@core/subject-tracking/domain/SeenPerson';

/**
 * Whether a reframed part's camera follows its person, decided on the
 * framing the model chose: a vertical crop a third of the picture wide,
 * centred on `HELD`. Two people stand in the part's middle frame, one
 * inside that framing and one far to its left.
 */

const CROP = { width: 0.3, height: 1 };
const HELD = { x: 0.7, y: 0.5 };
const PART: FramingPart = { take: 0, startSec: 0, endSec: 6, content: 'several people', subject: { description: 'the man on the right', name: 'the man' } };

function personAt(x: number): SeenPerson {
  return { box: { minX: x - 0.05, minY: 0.1, maxX: x + 0.05, maxY: 0.9 }, head: { x, y: 0.3 } };
}

/** Finds the people listed, at whatever moment it is asked about; nobody where none are listed; or fails. */
class ListedPeople implements PeopleFinder {
  asked = 0;

  constructor(private readonly people: ReadonlyArray<SeenPerson> | 'fails') {}

  async execute(moments: ReadonlyArray<number>): Promise<PeopleAtMoment | null> {
    this.asked += 1;
    if (this.people === 'fails') throw new Error('No WebGL2 here.');
    return this.people.length === 0 ? null : { sourceSec: moments[0]!, people: this.people };
  }
}

/** Plans as told: a moving or still follow, the framing kept, or waits until it is stopped. */
class ScriptedPlanning implements PersonFollowPlanning {
  readonly asked: PlanPersonFollowInput[] = [];

  constructor(private readonly answer: 'moving' | 'still' | 'held' | 'waits') {}

  async execute(input: PlanPersonFollowInput): Promise<PersonFollow | null> {
    this.asked.push(input);
    if (this.answer === 'waits') {
      return new Promise((_, reject) => input.signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError'))));
    }
    return {
      heads: [{ sourceSec: 1, x: 0.6, y: 0.3 }, { sourceSec: 5, x: 0.9, y: 0.3 }],
      plan: { kind: this.answer, points: [{ sourceSec: 0, x: 0.7, y: 0.5 }] },
    };
  }
}

function followerWith(finder: PeopleFinder, planning: PersonFollowPlanning, timeLimitSec = 60): ReframePartFollower {
  const store = new EditorStore();
  store.patchVideo({ layout: { width: 1920, height: 1080 } });
  return new ReframePartFollower(finder, planning, new PartMoments(store), store, () => timeLimitSec);
}

describe('ReframePartFollower', () => {
  it('follows the person inside the framing the model chose, not the one beside it, keeping the frame they were picked on', async () => {
    const planning = new ScriptedPlanning('moving');

    const outcome = await followerWith(new ListedPeople([personAt(0.1), personAt(0.75)]), planning).decide(PART, HELD, CROP, new AbortController().signal);

    expect(planning.asked[0]!.pick.position).toEqual({ x: 0.75, y: 0.3 });
    expect(planning.asked[0]!.held).toEqual(HELD);
    expect(planning.asked[0]!.stretch).toEqual({ startSec: 0, endSec: 6 });
    expect(outcome.kind).toBe('follow');
    if (outcome.kind !== 'follow') return;
    expect(outcome.follow.pictureAspectRatio).toBeCloseTo(16 / 9, 5);
    expect(outcome.follow.picked).toMatchObject({ chosen: 1, people: [personAt(0.1), personAt(0.75)] });
    expect(outcome.follow.untilFound).toEqual(HELD);
  });

  it('keeps the framing where the person stays in its middle', async () => {
    const outcome = await followerWith(new ListedPeople([personAt(0.7)]), new ScriptedPlanning('held')).decide(PART, HELD, CROP, new AbortController().signal);

    expect(outcome).toEqual({ kind: 'fixed' });
  });

  it('centres the framing on a person who stays off its middle, as a follow that holds still', async () => {
    const outcome = await followerWith(new ListedPeople([personAt(0.78)]), new ScriptedPlanning('still')).decide(PART, HELD, CROP, new AbortController().signal);

    expect(outcome.kind).toBe('follow');
  });

  it('keeps a framing that holds two people, though the one followed stays off its middle', async () => {
    const outcome = await followerWith(new ListedPeople([personAt(0.62), personAt(0.78)]), new ScriptedPlanning('still')).decide(PART, HELD, CROP, new AbortController().signal);

    expect(outcome).toEqual({ kind: 'fixed' });
  });

  it('keeps the framing where nobody found is inside it', async () => {
    const planning = new ScriptedPlanning('moving');

    const outcome = await followerWith(new ListedPeople([personAt(0.1)]), planning).decide(PART, HELD, CROP, new AbortController().signal);

    expect(outcome).toEqual({ kind: 'fixed' });
    expect(planning.asked).toEqual([]);
  });

  it('does not look at a part that shows nobody', async () => {
    const finder = new ListedPeople([personAt(0.7)]);

    const outcome = await followerWith(finder, new ScriptedPlanning('moving')).decide({ ...PART, content: 'no person' }, HELD, CROP, new AbortController().signal);

    expect(outcome).toEqual({ kind: 'fixed' });
    expect(finder.asked).toBe(0);
  });

  it('gives up following a part that takes longer than its time limit', async () => {
    const outcome = await followerWith(new ListedPeople([personAt(0.7)]), new ScriptedPlanning('waits'), 0.01).decide(PART, HELD, CROP, new AbortController().signal);

    expect(outcome).toEqual({ kind: 'too-long' });
  });

  it('says it failed where the people cannot be looked at', async () => {
    const outcome = await followerWith(new ListedPeople('fails'), new ScriptedPlanning('moving')).decide(PART, HELD, CROP, new AbortController().signal);

    expect(outcome).toEqual({ kind: 'failed' });
  });

  it('stops with the turn, rather than reporting it as too long', async () => {
    const turn = new AbortController();
    const deciding = followerWith(new ListedPeople([personAt(0.7)]), new ScriptedPlanning('waits')).decide(PART, HELD, CROP, turn.signal);
    await new Promise((resolve) => setTimeout(resolve, 0));
    turn.abort(new DOMException('The turn was stopped', 'AbortError'));

    await expect(deciding).rejects.toMatchObject({ name: 'AbortError' });
  });
});
