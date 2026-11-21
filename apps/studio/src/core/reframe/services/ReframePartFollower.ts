import type { FramingPart } from '@core/reframe/domain/FramingPart';
import type { PartFollower, PartFollowOutcome } from '@core/reframe/domain/PartFollower';
import type { PartMoments } from '@core/reframe/services/PartMoments';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { PlanPersonFollowInput } from '@core/subject-tracking/actions/PlanPersonFollowAction';
import type { CropSize } from '@core/subject-tracking/domain/CropSize';
import type { PeopleAtMoment } from '@core/subject-tracking/domain/PeopleAtMoment';
import type { PersonFollow } from '@core/subject-tracking/domain/PersonFollow';
import type { PicturePosition } from '@core/subject-tracking/domain/PicturePosition';

/** Finds who is at the first of a few moments of the video in which anyone is, from left to right. */
export interface PeopleFinder {
  execute(moments: ReadonlyArray<number>, signal: AbortSignal): Promise<PeopleAtMoment | null>;
}

/** Follows a picked person through a stretch, and plans how a crop follows them. */
export interface PersonFollowPlanning {
  execute(input: PlanPersonFollowInput): Promise<PersonFollow | null>;
}

const FIXED: PartFollowOutcome = { kind: 'fixed' };
// Following a part may take this long, and this much more per second of it, before the part keeps its fixed framing.
// A low-end phone took 1.4 s per second of a part to follow it from a 4K original.
const TIME_LIMIT_SEC = 10;
const TIME_LIMIT_PER_PART_SEC = 2;

/**
 * Decides whether the camera of a framed part follows the person it
 * frames: finds the people in the part's middle frame, takes the one
 * whose head is inside the framing the model chose (the nearest to its
 * middle), and follows them through the part, which keeps the framing
 * as it is where they stay in its middle. Where they stay off its
 * middle but inside one framing, that framing is centred on them
 * instead, unless the model's framing holds someone else too, as a
 * framing of two people does. A part showing nobody, or whose framing
 * holds no one found, keeps its framing. Following a part may take
 * `timeLimitSecOf` its length in seconds, by default 10 s and 2 s more per
 * second of the part, before the part keeps its framing.
 */
export class ReframePartFollower implements PartFollower {
  constructor(
    private readonly finder: PeopleFinder,
    private readonly planner: PersonFollowPlanning,
    private readonly moments: PartMoments,
    private readonly store: EditorStore,
    private readonly timeLimitSecOf: (partSec: number) => number = (partSec) => TIME_LIMIT_SEC + TIME_LIMIT_PER_PART_SEC * partSec,
  ) {}

  async decide(part: FramingPart, held: PicturePosition, crop: CropSize, signal: AbortSignal): Promise<PartFollowOutcome> {
    if (part.content === 'no person') return FIXED;
    const moments = this.moments.of(part.startSec, part.endSec);
    let found: PeopleAtMoment | null;
    try {
      found = await this.finder.execute([moments[Math.floor(moments.length / 2)]!], signal);
    } catch (error) {
      if (signal.aborted) throw error;
      return { kind: 'failed' };
    }
    if (found === null) return FIXED;
    const inFraming = found.people.flatMap((person, index) => (this.isInside(person.head, held, crop) ? [index] : []));
    const chosen = this.nearestTo(held, found, inFraming);
    return chosen === null ? FIXED : this.followed(part, found, chosen, held, crop, inFraming.length > 1, signal);
  }

  private isInside(head: PicturePosition, held: PicturePosition, crop: CropSize): boolean {
    return Math.abs(head.x - held.x) <= crop.width / 2 && Math.abs(head.y - held.y) <= crop.height / 2;
  }

  /** Of the people `indices` names, the one whose head is nearest the framing's middle; null where there is none. */
  private nearestTo(held: PicturePosition, found: PeopleAtMoment, indices: ReadonlyArray<number>): number | null {
    let chosen: number | null = null;
    let nearest = Infinity;
    for (const index of indices) {
      const { head } = found.people[index]!;
      const distance = Math.hypot(head.x - held.x, head.y - held.y);
      if (distance < nearest) {
        nearest = distance;
        chosen = index;
      }
    }
    return chosen;
  }

  /**
   * Follows the person `chosen` through the part within the time limit;
   * the part keeps its framing where they stay in its middle, or where
   * they stay inside one framing and the model's holds `others` too.
   */
  private async followed(
    part: FramingPart,
    found: PeopleAtMoment,
    chosen: number,
    held: PicturePosition,
    crop: CropSize,
    others: boolean,
    signal: AbortSignal,
  ): Promise<PartFollowOutcome> {
    const limit = new AbortController();
    const stopWithTurn = () => limit.abort(signal.reason);
    signal.addEventListener('abort', stopWithTurn, { once: true });
    const timer = setTimeout(() => limit.abort(), this.timeLimitSecOf(part.endSec - part.startSec) * 1000);
    try {
      const followed = await this.planner.execute({
        stretch: { startSec: part.startSec, endSec: part.endSec },
        pick: { sourceSec: found.sourceSec, position: found.people[chosen]!.head },
        crop,
        held,
        signal: limit.signal,
        onProgress: () => undefined,
      });
      const picture = this.store.snapshot().video.layout;
      if (followed === null || followed.plan.kind === 'held' || (followed.plan.kind === 'still' && others) || picture === null || !(picture.height > 0)) return FIXED;
      return {
        kind: 'follow',
        follow: {
          pictureAspectRatio: picture.width / picture.height,
          heads: followed.heads,
          picked: { sourceSec: found.sourceSec, people: found.people.map(({ box, head }) => ({ box, head })), chosen },
          untilFound: held,
        },
      };
    } catch (error) {
      if (signal.aborted) throw error;
      return limit.signal.aborted ? { kind: 'too-long' } : { kind: 'failed' };
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', stopWithTurn);
    }
  }
}
