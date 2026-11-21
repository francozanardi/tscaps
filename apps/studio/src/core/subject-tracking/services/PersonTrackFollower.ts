import type { PersonPick } from '@core/subject-tracking/domain/PersonPick';
import type { PersonSighting } from '@core/subject-tracking/domain/PersonSighting';
import type { PersonTrack, TrackStep } from '@core/subject-tracking/domain/PersonTrack';
import type { PicturePosition } from '@core/subject-tracking/domain/PicturePosition';
import type { SightedFrame } from '@core/subject-tracking/domain/SightedFrame';

/** Someone followed on a walk through the frames: where they were last seen, and when; null once they are given up. */
interface Walker {
  last: PersonSighting | null;
  lastSec: number;
}

/** A pair of a person followed and a person seen in the next frame, and how far apart their heads are. */
interface Candidate {
  readonly walker: Walker;
  readonly person: PersonSighting;
  readonly distance: number;
}

// How far from a person's box a pick may land and still name them, as a share of the picture.
const PICK_REACH = 0.1;
// How far from the picked moment the person may first be found, in seconds.
const PICK_WINDOW_SEC = 1;
// How far a person may move from one frame to the next, in their own widths: this much at once, and this much more per second apart.
const REACH_AT_ONCE = 0.5;
const REACH_PER_SEC = 1.5;
// A person's width is taken as at least this share of their height, so arms held close do not shrink their reach.
const MIN_WIDTH_OF_HEIGHT = 0.25;
// A person this much bigger or smaller than the one followed is someone else.
const MAX_SIZE_RATIO = 2;
// A person not seen for this long is not looked for again: anyone found after it could be someone else.
const MAX_UNSEEN_SEC = 2;

/**
 * Follows one person through frames: finds who was picked, then walks
 * forwards and backwards from there following everyone at once, so a
 * person nobody found in a frame is never mistaken for someone beside
 * them. In each frame the closest pairs of a person followed and a
 * person seen are joined first, as long as they are near enough for
 * the time between the frames and of a like size; whoever is left
 * starts being followed too.
 */
export class PersonTrackFollower {
  /** The picked person through every frame of `frames` (in time order); null where nobody is near the pick. */
  follow(frames: ReadonlyArray<SightedFrame>, pick: PersonPick): PersonTrack | null {
    const start = this.pickedIn(frames, pick);
    if (start === null) return null;
    const startSec = frames[start.index]!.sourceSec;
    const before = this.walk(frames, start.index, -1, start.sighting).reverse();
    const after = this.walk(frames, start.index, 1, start.sighting);
    return { steps: [...before, { sourceSec: startSec, sighting: start.sighting }, ...after] };
  }

  /** The frame nearest the pick in which someone is at the picked place, and who. */
  private pickedIn(frames: ReadonlyArray<SightedFrame>, pick: PersonPick): { index: number; sighting: PersonSighting } | null {
    const nearestFirst = frames
      .map((frame, index) => ({ frame, index }))
      .filter(({ frame }) => Math.abs(frame.sourceSec - pick.sourceSec) <= PICK_WINDOW_SEC)
      .sort((first, second) => Math.abs(first.frame.sourceSec - pick.sourceSec) - Math.abs(second.frame.sourceSec - pick.sourceSec));
    for (const { frame, index } of nearestFirst) {
      const sighting = this.personAt(frame.people, pick.position);
      if (sighting !== null) return { index, sighting };
    }
    return null;
  }

  /** Of the people whose box holds `position` or lies near it, the one whose head is nearest it. */
  private personAt(people: ReadonlyArray<PersonSighting>, position: PicturePosition): PersonSighting | null {
    const near = people.filter((person) => this.distanceToBox(person, position) <= PICK_REACH);
    if (near.length === 0) return null;
    return near.reduce((best, person) => (this.distance(person.head, position) < this.distance(best.head, position) ? person : best));
  }

  /**
   * The picked person's step in each frame from `startIndex` (excluded)
   * in `direction`, in walking order, everyone else in the start frame
   * followed beside them.
   */
  private walk(frames: ReadonlyArray<SightedFrame>, startIndex: number, direction: 1 | -1, picked: PersonSighting): TrackStep[] {
    const startSec = frames[startIndex]!.sourceSec;
    const followed: Walker = { last: picked, lastSec: startSec };
    let walkers: Walker[] = [followed, ...frames[startIndex]!.people.filter((person) => person !== picked).map((person) => ({ last: person, lastSec: startSec }))];
    const steps: TrackStep[] = [];
    for (let index = startIndex + direction; index >= 0 && index < frames.length; index += direction) {
      const frame = frames[index]!;
      const joined = this.joined(walkers, frame);
      walkers = [...walkers.filter((walker) => walker.last !== null), ...this.newcomers(frame, joined)];
      steps.push({ sourceSec: frame.sourceSec, sighting: joined.get(followed) ?? null });
    }
    return steps;
  }

  /**
   * Joins the people seen in `frame` to the people followed, closest
   * pairs first, and moves each joined walker on; a walker unseen for
   * too long is given up. The result says who each walker was joined to.
   */
  private joined(walkers: ReadonlyArray<Walker>, frame: SightedFrame): Map<Walker, PersonSighting> {
    const candidates = walkers.flatMap((walker) => this.candidatesFor(walker, frame));
    candidates.sort((first, second) => first.distance - second.distance);
    const joined = new Map<Walker, PersonSighting>();
    const taken = new Set<PersonSighting>();
    for (const candidate of candidates) {
      if (joined.has(candidate.walker) || taken.has(candidate.person)) continue;
      joined.set(candidate.walker, candidate.person);
      taken.add(candidate.person);
    }
    for (const walker of walkers) {
      const person = joined.get(walker);
      if (person !== undefined) {
        walker.last = person;
        walker.lastSec = frame.sourceSec;
      } else if (Math.abs(frame.sourceSec - walker.lastSec) > MAX_UNSEEN_SEC) {
        walker.last = null;
      }
    }
    return joined;
  }

  /** The people of `frame` near enough to where `walker` was last seen, and of a like size. */
  private candidatesFor(walker: Walker, frame: SightedFrame): Candidate[] {
    const last = walker.last;
    if (last === null) return [];
    const elapsedSec = Math.abs(frame.sourceSec - walker.lastSec);
    const reach = this.widthOf(last) * (REACH_AT_ONCE + REACH_PER_SEC * elapsedSec);
    return frame.people
      .map((person) => ({ walker, person, distance: this.distance(person.head, last.head) }))
      .filter((candidate) => candidate.distance <= reach && this.likeSized(candidate.person, last));
  }

  /** The people of `frame` joined to nobody, as new walkers. */
  private newcomers(frame: SightedFrame, joined: ReadonlyMap<Walker, PersonSighting>): Walker[] {
    const taken = new Set(joined.values());
    return frame.people.filter((person) => !taken.has(person)).map((person) => ({ last: person, lastSec: frame.sourceSec }));
  }

  /** Whether two sightings could be the same person by their size; a face is not compared with a body. */
  private likeSized(person: PersonSighting, followed: PersonSighting): boolean {
    if (person.source !== followed.source) return true;
    const ratio = this.widthOf(person) / this.widthOf(followed);
    return ratio <= MAX_SIZE_RATIO && ratio >= 1 / MAX_SIZE_RATIO;
  }

  private widthOf(person: PersonSighting): number {
    const width = person.box.maxX - person.box.minX;
    const height = person.box.maxY - person.box.minY;
    return Math.max(width, height * MIN_WIDTH_OF_HEIGHT, Number.EPSILON);
  }

  private distanceToBox(person: PersonSighting, position: PicturePosition): number {
    const dx = Math.max(person.box.minX - position.x, 0, position.x - person.box.maxX);
    const dy = Math.max(person.box.minY - position.y, 0, position.y - person.box.maxY);
    return Math.hypot(dx, dy);
  }

  private distance(first: PicturePosition, second: PicturePosition): number {
    return Math.hypot(first.x - second.x, first.y - second.y);
  }
}
