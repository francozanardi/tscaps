import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SurveyedPerson, TakeSurvey } from '@core/reframe/domain/TakeSurvey';
import type { VideoTake } from '@core/reframe/domain/VideoTake';
import type { PersonSighting } from '@core/subject-tracking/domain/PersonSighting';
import type { SamplingStretch } from '@core/subject-tracking/domain/SamplingStretch';
import type { SightedFrame } from '@core/subject-tracking/domain/SightedFrame';

/** Finds everyone seen through stretches of the open video, frame by frame at each stretch's rate. */
export interface PeopleSighting {
  execute(stretches: ReadonlyArray<SamplingStretch>, signal: AbortSignal, onProgress: (fraction: number) => void): Promise<SightedFrame[]>;
}

/** One sighting of a person, and the frame it was in. */
interface TimedSighting {
  readonly sourceSec: number;
  readonly sighting: PersonSighting;
}

const LETTERS = 'ABCDEFGH';
// Kept clear of a take's ends, where a transition or the frame of the next take can show.
const EDGE_SEC = 0.15;
// A frame a second tells who is in a take and where they stay; a short take is still looked at a few times.
const FRAMES_PER_SECOND = 1;
const MIN_FRAMES = 3;
const MAX_FRAMES_PER_SECOND = 4;
// A take too short to keep clear of its ends is looked at once, in its middle: a stretch this long gives that one frame.
const MOMENT_SEC = 0.01;
// How far a head may be from where the same person's was last seen, as a share of the picture: this much at once and
// this much more per second since, up to a limit that keeps two people sitting apart from being taken for one.
const REACH_AT_ONCE = 0.08;
const REACH_PER_SEC = 0.06;
const MAX_REACH = 0.25;
// Someone seen once in a take of many frames is a passer-by or a mistake of the detector: a person of the take is
// seen at least twice, or in this share of its frames where it has few.
const MIN_SIGHTINGS = 2;
const MIN_SEEN_SHARE = 1 / 3;

/**
 * Finds who is in each take of the open video. It looks at every take a
 * frame a second and gathers the sightings of each person across those
 * frames by where their head is, since a detector misses a small or
 * turned face in one frame and finds it in the next: a person of the
 * take is whoever is seen in enough of its frames, wherever in the take
 * that is. The take is pictured at the frame that shows the most of
 * them, the one nearest its middle among equals, and they are lettered
 * there from left to right. What it found is kept for the video it was
 * found in, so asking again about a take costs nothing.
 */
export class TakeSurveyor {
  private surveyedVideo: Blob | null = null;
  private readonly known = new Map<string, TakeSurvey>();

  constructor(
    private readonly store: EditorStore,
    private readonly sighting: PeopleSighting,
  ) {}

  /**
   * The survey of each of `takes`, in their order. `onProgress` is told
   * how far the looking is, from 0 to 1. Rejects with an `AbortError`
   * once `signal` fires, and with the cause where the video cannot be
   * read or the detector cannot run.
   */
  async survey(takes: ReadonlyArray<VideoTake>, signal: AbortSignal, onProgress: (fraction: number) => void): Promise<TakeSurvey[]> {
    this.forgetAnotherVideo();
    const unknown = takes.filter((take) => !this.known.has(this.keyOf(take)));
    if (unknown.length > 0) {
      const frames = await this.sighting.execute(unknown.map((take) => this.stretchOf(take)), signal, onProgress);
      for (const take of unknown) this.known.set(this.keyOf(take), this.surveyOf(take, frames));
    }
    onProgress(1);
    return takes.map((take) => ({ ...this.known.get(this.keyOf(take))!, take }));
  }

  private forgetAnotherVideo(): void {
    const video = this.store.snapshot().video.file;
    if (video === this.surveyedVideo) return;
    this.surveyedVideo = video;
    this.known.clear();
  }

  private keyOf(take: VideoTake): string {
    return `${take.startSec}:${take.endSec}`;
  }

  /** The stretch of `take` looked at, clear of its ends, at a rate that gives a short take a few frames. */
  private stretchOf(take: VideoTake): SamplingStretch {
    const startSec = take.startSec + EDGE_SEC;
    const endSec = take.endSec - EDGE_SEC;
    if (endSec <= startSec) {
      const middle = (take.startSec + take.endSec) / 2;
      return { startSec: middle, endSec: middle + MOMENT_SEC, framesPerSecond: FRAMES_PER_SECOND };
    }
    const framesPerSecond = Math.min(MAX_FRAMES_PER_SECOND, Math.max(FRAMES_PER_SECOND, (MIN_FRAMES - 1) / (endSec - startSec)));
    return { startSec, endSec, framesPerSecond };
  }

  private surveyOf(take: VideoTake, frames: ReadonlyArray<SightedFrame>): TakeSurvey {
    const inTake = frames.filter((frame) => frame.sourceSec >= take.startSec && frame.sourceSec < take.endSec);
    const middle = (take.startSec + take.endSec) / 2;
    const people = this.gathered(inTake).filter((sightings) => this.isOfTheTake(sightings.length, inTake.length));
    const pictureSec = this.fullestMoment(people, middle) ?? inTake[Math.floor(inTake.length / 2)]?.sourceSec ?? Math.round(middle * 100) / 100;
    const surveyed = people
      .map((sightings) => this.personOf(sightings, pictureSec))
      .sort((first, second) => first.at.x - second.at.x)
      .slice(0, LETTERS.length)
      .map((person, index) => ({ ...person, letter: LETTERS[index]! }));
    return { take, pictureSec, people: surveyed };
  }

  /**
   * The sightings of each person through `frames`, in time order: in
   * every frame the closest pairs of a person already seen and a person
   * in it are joined first, within reach of where that person was last;
   * whoever is left is someone new.
   */
  private gathered(frames: ReadonlyArray<SightedFrame>): TimedSighting[][] {
    const people: TimedSighting[][] = [];
    for (const frame of frames) {
      const pairs = people.flatMap((sightings) => {
        const last = sightings[sightings.length - 1]!;
        const reach = Math.min(MAX_REACH, REACH_AT_ONCE + REACH_PER_SEC * (frame.sourceSec - last.sourceSec));
        return frame.people
          .map((person) => ({ sightings, person, distance: Math.hypot(person.head.x - last.sighting.head.x, person.head.y - last.sighting.head.y) }))
          .filter((pair) => pair.distance <= reach);
      });
      pairs.sort((first, second) => first.distance - second.distance);
      const joined = new Set<TimedSighting[]>();
      const taken = new Set<PersonSighting>();
      for (const pair of pairs) {
        if (joined.has(pair.sightings) || taken.has(pair.person)) continue;
        pair.sightings.push({ sourceSec: frame.sourceSec, sighting: pair.person });
        joined.add(pair.sightings);
        taken.add(pair.person);
      }
      for (const person of frame.people) {
        if (!taken.has(person)) people.push([{ sourceSec: frame.sourceSec, sighting: person }]);
      }
    }
    return people;
  }

  private isOfTheTake(sightings: number, frames: number): boolean {
    return sightings >= MIN_SIGHTINGS || sightings / frames >= MIN_SEEN_SHARE;
  }

  /** The moment the most of `people` are seen at, the nearest `middle` among equals; null where there is nobody. */
  private fullestMoment(people: ReadonlyArray<ReadonlyArray<TimedSighting>>, middle: number): number | null {
    const seenAt = new Map<number, number>();
    for (const sightings of people) {
      for (const { sourceSec } of sightings) seenAt.set(sourceSec, (seenAt.get(sourceSec) ?? 0) + 1);
    }
    let fullest: number | null = null;
    for (const [sourceSec, count] of seenAt) {
      const best = fullest === null ? 0 : seenAt.get(fullest)!;
      if (fullest === null || count > best || (count === best && Math.abs(sourceSec - middle) < Math.abs(fullest - middle))) fullest = sourceSec;
    }
    return fullest;
  }

  /** A person from their sightings: where their head stays, how far it goes, and where it is at `pictureSec`, or nearest it. */
  private personOf(sightings: ReadonlyArray<TimedSighting>, pictureSec: number): Omit<SurveyedPerson, 'letter'> {
    const pictured = sightings.reduce((nearest, each) => (Math.abs(each.sourceSec - pictureSec) < Math.abs(nearest.sourceSec - pictureSec) ? each : nearest));
    const xs = sightings.map((each) => each.sighting.head.x);
    const heights = sightings.flatMap((each) => (each.sighting.headHeight === null ? [] : [each.sighting.headHeight]));
    return {
      at: pictured.sighting.head,
      head: { x: this.middleOf(xs), y: this.middleOf(sightings.map((each) => each.sighting.head.y)) },
      headHeight: heights.length > 0 ? this.middleOf(heights) : null,
      fromX: Math.min(...xs),
      toX: Math.max(...xs),
    };
  }

  /** The median of `values`. */
  private middleOf(values: ReadonlyArray<number>): number {
    const sorted = [...values].sort((first, second) => first - second);
    const half = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[half]! : (sorted[half - 1]! + sorted[half]!) / 2;
  }
}
