import { describe, expect, it } from 'vitest';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { Document, Line, RenderTimeMap, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';
import { ShotBoundaryFinder } from '@core/shots/services/ShotBoundaryFinder';
import { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';
import { SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';
import { ShotPartitioner } from '@core/shots/services/ShotPartitioner';

/**
 * Where the video gets cut into shots before anyone has touched it.
 *
 * Two things are under test and they answer to different rules. The
 * partition itself has to cover the video from zero to its end with no
 * gap and no overlap, because every other surface reads it that way.
 * The choice of boundary is a ranking, and what matters is which kind
 * of signal wins when several are in reach.
 */

const VIDEO_DURATION = 60;
const BUDGET = { maxSec: 6, minSec: 2 };

interface SegmentSpec {
  readonly start: number;
  readonly end: number;
  /** Ends the segment's only word, punctuation included. Defaults to a bare word. */
  readonly text?: string;
  readonly score?: number;
  readonly sheetId?: string;
  /** Where the caption stays on screen until, past its words, as a template holding it there sets. */
  readonly heldUntil?: number;
}

function segmentOf(spec: SegmentSpec, index: number): Segment {
  return new Segment({
    id: `s${index}`,
    ...(spec.heldUntil === undefined ? {} : { effectTime: new TimeFragment(spec.start, spec.heldUntil) }),
    lines: [new Line({ words: [new Word({
      text: spec.text ?? `w${index}`,
      time: new TimeFragment(spec.start, spec.end),
      boundaryScore: spec.score ?? null,
    })] })],
  });
}

/** One section per sheet, as the deriver builds them, from specs given in time order. */
function documentOf(specs: ReadonlyArray<SegmentSpec>): Document {
  const bySheet = new Map<string, Segment[]>();
  specs.forEach((spec, index) => {
    const sheetId = spec.sheetId ?? 'main';
    const held = bySheet.get(sheetId) ?? [];
    held.push(segmentOf(spec, index));
    bySheet.set(sheetId, held);
  });
  return new Document({
    sections: [...bySheet].map(([kind, segments]) => new Section({ kind, segments })),
  });
}

function sheet(id: string, role: 'hook' | 'peak' | null): Sheet {
  return { id, role } as unknown as Sheet;
}

const MAIN_ONLY = [sheet('main', null)];

function partitionerOf(): ShotPartitioner {
  return new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder());
}

/** The opening time of each proposed shot. */
function openings(
  specs: ReadonlyArray<SegmentSpec>,
  sheets = MAIN_ONLY,
  budget = BUDGET,
  videoDurationSec = VIDEO_DURATION,
  pictureChangesSec: ReadonlyArray<number> = [],
  cuts: CutRegistry = CutRegistry.empty(),
): number[] {
  return partitionerOf().propose(documentOf(specs), videoDurationSec, sheets, budget, pictureChangesSec, cuts);
}

/**
 * Where the word each proposed shot opens on starts: which boundary was
 * chosen, whatever instant inside its silence the cut landed on.
 */
function openingWords(
  specs: ReadonlyArray<SegmentSpec>,
  sheets = MAIN_ONLY,
  budget = BUDGET,
  videoDurationSec = VIDEO_DURATION,
  pictureChangesSec: ReadonlyArray<number> = [],
): number[] {
  const starts = specs.map((spec) => spec.start).sort((a, b) => a - b);
  return openings(specs, sheets, budget, videoDurationSec, pictureChangesSec).map((openingSec) => (
    openingSec === 0 ? 0 : starts.find((start) => start >= openingSec - PICTURE_CHANGE_SLACK_SEC) ?? openingSec
  ));
}

/** How far past a word's start a picture change may pull its shot's opening. */
const PICTURE_CHANGE_SLACK_SEC = 0.05;

/** One second of speech per segment, back to back, for a given count. */
function steadySpeech(count: number, gapSec = 0): SegmentSpec[] {
  return Array.from({ length: count }, (_, index) => ({
    start: index * (1 + gapSec),
    end: index * (1 + gapSec) + 1,
  }));
}

describe('ShotPartitioner', () => {
  it('covers the video from zero to its end, whatever the boundaries', () => {
    const shots = openings(steadySpeech(30));

    expect(shots[0]).toBe(0);
    for (let i = 1; i < shots.length; i += 1) {
      expect(shots[i]!).toBeGreaterThan(shots[i - 1]!);
    }
  });

  it('cuts a video that never pauses, rather than leaving it whole', () => {
    // The case the pause-only partition failed at: fast narration with
    // no silence anywhere in it.
    const shots = openings(steadySpeech(30));

    expect(shots.length).toBeGreaterThan(1);
    for (let i = 1; i < shots.length; i += 1) {
      expect(shots[i]! - shots[i - 1]!).toBeLessThanOrEqual(BUDGET.maxSec);
    }
  });

  it('cuts at the longest silence in the window when nothing else marks one', () => {
    const shots = openingWords([
      { start: 0, end: 1 },
      { start: 1.2, end: 2 },
      { start: 2.9, end: 4 },
      { start: 4.1, end: 6 },
      ...steadySpeech(20).map((spec) => ({ start: spec.start + 6, end: spec.end + 6 })),
    ]);

    expect(shots[1]).toBe(2.9);
  });

  it('cuts where the sentence ended, not where the longest silence fell', () => {
    const shots = openingWords([
      { start: 0, end: 1 },
      { start: 1.1, end: 2, text: 'stop.' },
      { start: 2.4, end: 3 },
      { start: 5.5, end: 6 },
      ...steadySpeech(20).map((spec) => ({ start: spec.start + 6, end: spec.end + 6 })),
    ]);

    // 5.5 opens after the longest silence of the three; 2.4 opens after
    // the full stop, and that is the one worth cutting on.
    expect(shots[1]).toBe(2.4);
  });

  it('falls to the end of a clause where no sentence ends inside the window', () => {
    const shots = openingWords([
      { start: 0, end: 1 },
      { start: 1.1, end: 2, text: 'then,' },
      { start: 2.4, end: 3 },
      { start: 3.1, end: 4 },
      ...steadySpeech(20).map((spec) => ({ start: spec.start + 6, end: spec.end + 6 })),
    ]);

    expect(shots[1]).toBe(2.4);
  });

  it('lets the model rank the sentence ends the transcription punctuated', () => {
    const shots = openingWords([
      { start: 0, end: 1 },
      { start: 1.1, end: 2, text: 'first.', score: 0.3 },
      { start: 2.4, end: 3, score: 0.9 },
      { start: 3.1, end: 4, text: 'second.', score: 0.8 },
      { start: 4.2, end: 5 },
      ...steadySpeech(20).map((spec) => ({ start: spec.start + 6, end: spec.end + 6 })),
    ]);

    // 2.4 carries the highest score of the window and closes nothing;
    // of the two that close a sentence, 4.2 is the stronger.
    expect(shots[1]).toBe(4.2);
  });

  it('falls to the model alone where the transcription punctuated nothing', () => {
    const shots = openingWords([
      { start: 0, end: 1 },
      { start: 1.1, end: 2, score: 0.2 },
      { start: 2.4, end: 3, score: 0.9 },
      { start: 3.1, end: 4, score: 0.1 },
      ...steadySpeech(20).map((spec) => ({ start: spec.start + 6, end: spec.end + 6 })),
    ]);

    expect(shots[1]).toBe(3.1);
  });

  it('cuts at the strongest score where a model wrote them', () => {
    const shots = openingWords([
      { start: 0, end: 1 },
      { start: 1.1, end: 2, score: 0.2 },
      { start: 2.2, end: 3, score: 0.9 },
      { start: 3.3, end: 4, score: 0.1 },
      ...steadySpeech(20).map((spec) => ({ start: spec.start + 6, end: spec.end + 6 })),
    ]);

    // The 0.9 sits on the segment ending at 3, so the cut lands where
    // the next one starts.
    expect(shots[1]).toBe(3.3);
  });

  it('opens a shot where a role sheet starts, even sooner than a shot may be short', () => {
    const shots = openingWords([
      { start: 0, end: 1, sheetId: 'hook' },
      { start: 1.1, end: 2 },
      ...steadySpeech(20).map((spec) => ({ start: spec.start + 6, end: spec.end + 6 })),
    ], [sheet('main', null), sheet('hook', 'hook')]);

    expect(shots[0]).toBe(0);
    expect(shots[1]).toBe(1.1);
  });

  it('ignores a sheet change that only means another speaker', () => {
    const shots = openingWords([
      { start: 0, end: 1, sheetId: 'speaker-2' },
      { start: 1.1, end: 2 },
      ...steadySpeech(20).map((spec) => ({ start: spec.start + 6, end: spec.end + 6 })),
    ], [sheet('main', null), sheet('speaker-2', null)]);

    expect(shots[1]!).toBeGreaterThan(1.1);
  });

  it('does not give up the sentence end near the end of the video to keep the last shot above the floor', () => {
    // Reported from a real video: the last two shots came out 2.4s and
    // 2.2s, with "right?" opening the last one instead of closing the
    // one before it. Cutting after "right?" left 1.6s behind, under the
    // floor, so the only sentence end in reach was dropped and a comma
    // won.
    const shots = openingWords([
      { start: 0, end: 0.8, text: 'mean,' },
      { start: 0.86, end: 2.4, text: 'died,' },
      { start: 2.46, end: 2.9, text: 'right?' },
      { start: 3.0, end: 3.3, text: 'Yes.' },
      { start: 3.4, end: 4.6, text: 'know-' },
    ], MAIN_ONLY, BUDGET, 4.6);

    expect(shots).toEqual([0, 3.0]);
  });

  it('leaves a shot to absorb the rest wherever the boundaries allow it', () => {
    const shots = openings(steadySpeech(30));

    expect(VIDEO_DURATION - shots[shots.length - 1]!).toBeGreaterThanOrEqual(BUDGET.minSec);
  });

  it('reads segments in time order, not in the order their sections hold them', () => {
    const shots = openingWords([
      { start: 0, end: 1 },
      { start: 8, end: 9, sheetId: 'other' },
      { start: 16, end: 17 },
    ], [sheet('main', null), sheet('other', null)]);

    expect(shots).toEqual([0, 8, 16]);
  });

  it('has nothing to say about a video with no document, or no duration yet', () => {
    const partitioner = partitionerOf();

    expect(partitioner.propose(null, VIDEO_DURATION, MAIN_ONLY, BUDGET, [], CutRegistry.empty())).toEqual([]);
    expect(partitioner.propose(documentOf([{ start: 0, end: 1 }]), 0, MAIN_ONLY, BUDGET, [], CutRegistry.empty())).toEqual([]);
  });
});

/**
 * Once a boundary is chosen, the cut still has to land somewhere inside
 * the silence between its two words. Word times are aligned within a
 * few hundredths, so a cut on a word's start can open a shot on a sound
 * already under way; and a cut a few frames off an edit the video
 * already carries shows those frames of the old picture.
 */
describe('ShotPartitioner, where the cut lands inside the silence', () => {
  /** A sentence ends at 2, the next word starts at `nextStart`, and speech runs on from 6. */
  function oneBoundary(nextStart: number): SegmentSpec[] {
    return [
      { start: 0, end: 1 },
      { start: 1.1, end: 2, text: 'stop.' },
      { start: nextStart, end: 3.5 },
      ...steadySpeech(20).map((spec) => ({ start: spec.start + 6, end: spec.end + 6 })),
    ];
  }

  it('opens the shot a little before its first word where the silence allows it', () => {
    const shots = openings(oneBoundary(2.9));

    expect(shots[1]).toBeGreaterThan(2.6);
    expect(shots[1]).toBeLessThan(2.9);
  });

  it('keeps clear of the word before as well, where the silence is short', () => {
    const shots = openings(oneBoundary(2.1));

    expect(shots[1]).toBeGreaterThan(2);
    expect(shots[1]).toBeLessThan(2.1);
    // The word about to be heard gets the larger share of the silence.
    expect(2.1 - shots[1]!).toBeGreaterThan(shots[1]! - 2);
  });

  it('cuts on the word itself where there is no silence at all', () => {
    expect(openings(oneBoundary(2))[1]).toBe(2);
  });

  it('never moves a cut onto either word', () => {
    const specs = steadySpeech(40, 0.08);
    const shots = openings(specs);

    for (const opening of shots.slice(1)) {
      expect(specs.some((spec) => opening > spec.start && opening < spec.end)).toBe(false);
    }
  });

  it('cuts exactly where the video already changes picture inside the silence', () => {
    expect(openings(oneBoundary(2.9), MAIN_ONLY, BUDGET, VIDEO_DURATION, [2.3])[1]).toBe(2.3);
  });

  it('trusts the picture over the word times when they disagree by a frame', () => {
    // A jump cut with no pause left in it: the edit sits a frame after
    // where the aligner put the next word's start.
    expect(openings(oneBoundary(2), MAIN_ONLY, BUDGET, VIDEO_DURATION, [2.03])[1]).toBe(2.03);
  });

  it('cuts where the picture changes before where a sentence ends', () => {
    const specs: SegmentSpec[] = [
      { start: 0, end: 1 },
      { start: 1.1, end: 2, text: 'stop.' },
      { start: 2.4, end: 3 },
      { start: 3, end: 4 },
      ...steadySpeech(20).map((spec) => ({ start: spec.start + 6, end: spec.end + 6 })),
    ];

    expect(openings(specs, MAIN_ONLY, BUDGET, VIDEO_DURATION, [3])[1]).toBe(3);
  });

  it('reads the silence between the words, not between captions held on screen until the next', () => {
    const held = oneBoundary(2.9).map((spec, index, all) => ({ ...spec, heldUntil: all[index + 1]?.start ?? spec.end }));

    const shots = openings(held);
    expect(shots[1]).toBeGreaterThan(2.6);
    expect(shots[1]).toBeLessThan(2.9);
    expect(openings(held, MAIN_ONLY, BUDGET, VIDEO_DURATION, [2.3])[1]).toBe(2.3);
  });

  it('ignores a picture change that falls inside a word', () => {
    const specs = oneBoundary(2.4);

    expect(openingWords(specs, MAIN_ONLY, BUDGET, VIDEO_DURATION, [3])[1]).toBe(2.4);
  });

  it('still opens a shot where a role sheet starts, picture change or not', () => {
    const shots = openingWords([
      { start: 0, end: 1, sheetId: 'hook' },
      { start: 1.1, end: 2 },
      { start: 2.6, end: 3 },
      ...steadySpeech(20).map((spec) => ({ start: spec.start + 6, end: spec.end + 6 })),
    ], [sheet('main', null), sheet('hook', 'hook')], BUDGET, VIDEO_DURATION, [2.5]);

    expect(shots[1]).toBe(1.1);
  });
});

/**
 * A proposal is of the video as it plays: what the user cut out of it
 * is not there to fill a shot or to cut between, and where a cut takes
 * out a pause the picture jumps there, the way an edit does.
 */
describe('ShotPartitioner, on a video with cuts', () => {
  const SPEECH = steadySpeech(40, 0.2);
  const CUTS = CutRegistry.empty().add({ startSec: 3.5, endSec: 20 });

  it('measures each shot as it plays, so a stretch cut away never makes one too short or too long', () => {
    const timeMap = new RenderTimeMap(CUTS.list());
    const shots = openings(SPEECH, MAIN_ONLY, BUDGET, 48, [], CUTS);
    const lengths = shots.slice(1).map((openingSec, index) => timeMap.toOutputTime(openingSec) - timeMap.toOutputTime(shots[index]!));

    expect(lengths.length).toBeGreaterThan(1);
    for (const lengthSec of lengths) {
      expect(lengthSec).toBeGreaterThanOrEqual(BUDGET.minSec);
      expect(lengthSec).toBeLessThanOrEqual(BUDGET.maxSec);
    }
  });

  it('never opens a shot inside what is cut, or on a word cut away', () => {
    const shots = openings(SPEECH, MAIN_ONLY, BUDGET, 48, [], CUTS);

    expect(shots.filter((openingSec) => openingSec > 3.5 && openingSec < 20)).toEqual([]);
  });

  it('opens a shot where a cut takes out a pause, before where a sentence ends', () => {
    const specs: SegmentSpec[] = [
      { start: 0, end: 1 },
      { start: 1.1, end: 2, text: 'stop.' },
      { start: 2.4, end: 3 },
      { start: 3.5, end: 4.5 },
      ...steadySpeech(20).map((spec) => ({ start: spec.start + 6, end: spec.end + 6 })),
    ];

    expect(openings(specs, MAIN_ONLY, BUDGET, VIDEO_DURATION, [], CutRegistry.empty().add({ startSec: 3.1, endSec: 3.4 }))[1]).toBe(3.4);
  });
});
