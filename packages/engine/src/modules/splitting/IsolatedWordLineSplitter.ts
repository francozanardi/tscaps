import type { LineSplitter } from '@modules/splitting/LineSplitter';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';
import type { TagCondition } from '@modules/tags/TagCondition';
import type { WordEdgeReader } from '@modules/splitting/WordEdgeReader';
import { Tag } from '@modules/tags/Tag';
import { StructureTag } from '@modules/tags/StructureTag';

export interface IsolatedWordLineSplitterConfig {
  /**
   * Fewest letters a word needs to stand on a line of its own. Counted
   * per letter, so in scripts that write a word in one or two characters
   * few words reach it.
   */
  readonly minLetters: number;
  /**
   * Least time, in seconds, a word must stay on screen — from the moment
   * it is said to the moment its segment ends — to stand on its own line.
   */
  readonly minSecondsOnScreen: number;
  /**
   * A looser time on screen, tried only when no word reaches
   * `minSecondsOnScreen`, so a segment still gets a word of its own
   * without a better candidate further back losing to a closer one. No
   * second pass when absent or not below `minSecondsOnScreen`.
   */
  readonly fallbackMinSecondsOnScreen?: number | undefined;
  /**
   * Tag conditions tried before the letters, in order: the first that
   * finds a word picks it, whatever its length. Absent means the letters
   * alone.
   */
  readonly tagPriority?: ReadonlyArray<TagCondition> | undefined;
  /** Which end of the segment the search starts from. Absent means the end. */
  readonly searchFrom?: IsolatedWordSearchFrom | undefined;
  /**
   * Whether the first word can stand on its own line too, a segment of
   * one word included. Absent means it cannot, which keeps the isolated
   * word on the second line, where a stylesheet can find it by position.
   */
  readonly allowFirstWord?: boolean | undefined;
  /**
   * Fewest words a segment needs before any of them is lifted. A shorter
   * segment stays on one line, unmarked. Absent means no floor.
   */
  readonly minSegmentWords?: number | undefined;
  /**
   * Fewest characters every line of the result may hold, counted as the
   * line paints them: code points, one separator between words. A word
   * whose lifting would leave a shorter line — before it, after it, or
   * itself — is passed over. Absent means no floor.
   */
  readonly minLineChars?: number | undefined;
  /**
   * How many segments, at the least, stay on one line, unmarked, between
   * two with a lifted word, so lifted words do not follow each other back
   * to back. Counted across the segments of one `split` call, in order.
   * Which segments get the lift is then chosen together rather than in
   * reading order: the set that keeps the spacing and whose lifted words
   * take the longest to say in total. A speaker draws out the words they
   * stress, so between two segments too close to both lift, that is the
   * one whose word is said more slowly; and it never gives up two lifts
   * for one said in less time than both together. Absent means none.
   */
  readonly minPlainSegmentsBetween?: number | undefined;
  /**
   * Which qualifying word a segment lifts when more than one does.
   * `position`, the default, takes the first in `searchFrom` order;
   * `spoken-duration` takes the one that takes longest to say, the one
   * the speaker stressed, with `searchFrom` order breaking ties.
   */
  readonly pickBy?: IsolatedWordPick | undefined;
  /**
   * Whether only the segment's two end words can be lifted: its last
   * word and, with `allowFirstWord`, its first, tried in `searchFrom`
   * order under every other rule. A lifted word then always opens or
   * closes its segment, so the rest of it sits on one side only. Absent
   * means any word.
   */
  readonly onlyAtEnds?: boolean | undefined;
  /**
   * How unevenly, in em of the lifted word's font, a word's letters may
   * end at its top or its bottom and still have a line on that side. A
   * word whose top is more uneven (an ascender or a capital among short
   * letters: "bounces") can only be lifted with nothing above it, as the
   * segment's first word; one whose bottom is (a descender: "money"),
   * only with nothing below it, as its last; one uneven at both ("sky"),
   * only alone. Read through the splitter's `WordEdgeReader`; absent, or
   * without a reader, the shape of a word does not matter.
   */
  readonly maxEdgeSpreadEm?: number | undefined;
}

export type IsolatedWordSearchFrom = 'end' | 'start';

export type IsolatedWordPick = 'position' | 'spoken-duration';

/** A word a segment could lift, and how long it takes to say. */
interface IsolationCandidate {
  readonly index: number;
  readonly secondsSaid: number;
}

/** The best choice of lifts over the segments from one index to the end. */
interface LiftPlan {
  readonly secondsSaid: number;
  readonly liftCount: number;
  readonly liftsHere: boolean;
}

const LETTER_PATTERN = /[\p{L}\p{N}]/gu;

/**
 * Lifts one word of each segment onto a line of its own, and marks that
 * line `ISOLATED_LINE`, so a stylesheet can address it. Unless
 * `allowFirstWord` is set, it is always the second line.
 *
 * The word is the latest one that has enough letters and stays on
 * screen long enough to be read. How fast it is said does not matter,
 * only how long it is shown: from the moment it is said until the
 * segment's `time` ends. That is the time the segment is shown for, so
 * run this after whatever shapes it — an effect holding a segment past
 * its last word, a time set by hand — or the word is judged on the
 * speech alone. The first word never qualifies, since the line above it
 * would be empty; `allowFirstWord` lets it qualify, and the isolated
 * line is then the first. `tagPriority` tries tags before the letters,
 * and `searchFrom` can take the earliest word instead of the latest.
 *
 * The result is one of these shapes:
 *
 * - the words before it, then the word — when the last word qualifies;
 * - the words before it, the word, then the words after it;
 * - the word, then the words after it — only with `allowFirstWord`;
 * - the word alone — a segment of one word, only with `allowFirstWord`;
 * - every word on one line, unmarked, when none qualifies, when the
 *   segment has fewer than `minSegmentWords` words, or when keeping
 *   `minPlainSegmentsBetween` leaves it out.
 *
 * Without `allowFirstWord`, a segment of two or more lines always has
 * exactly one word on its second line.
 */
export class IsolatedWordLineSplitter implements LineSplitter {

  /** @param edgeReader reads a word's edges when `maxEdgeSpreadEm` is set. */
  constructor(
    private readonly _config: IsolatedWordLineSplitterConfig,
    private readonly edgeReader: WordEdgeReader | null = null,
  ) {}

  // Durations are sums of floating-point differences; below this they tie.
  private static readonly TIE_TOLERANCE = 1e-9;

  split(segments: ReadonlyArray<Segment>): Segment[] {
    const candidates = segments.map((segment) => this.candidateIn(segment));
    const lifts = this.segmentsToLift(candidates);
    return segments.map((segment, index) => {
      const candidate = candidates[index];
      return lifts[index] && candidate ? this.lift(segment, candidate.index) : this.plain(segment);
    });
  }

  private lift(segment: Segment, isolatedIndex: number): Segment {
    const words = segment.getWords();
    const before = words.slice(0, isolatedIndex);
    const after = words.slice(isolatedIndex + 1);
    const lines: Line[] = [];
    if (before.length > 0) lines.push(new Line({ words: before }));
    lines.push(new Line({
      words: [words[isolatedIndex]!],
      structureTags: new Set([Tag.of(StructureTag.ISOLATED_LINE)]),
    }));
    if (after.length > 0) lines.push(new Line({ words: after }));
    return segment.with({ lines });
  }

  /** The segment with every word on one line, unmarked. */
  private plain(segment: Segment): Segment {
    const words = segment.getWords();
    if (words.length === 0) return segment;
    return segment.with({ lines: [new Line({ words })] });
  }

  /**
   * Which segments lift their candidate. Every one that has a candidate,
   * unless `minPlainSegmentsBetween` asks for spacing; then the spaced set
   * whose lifted words take longest to say in total, and among equal
   * totals the one with more lifts.
   */
  private segmentsToLift(candidates: ReadonlyArray<IsolationCandidate | null>): boolean[] {
    const gap = this._config.minPlainSegmentsBetween ?? 0;
    if (gap <= 0) return candidates.map((candidate) => candidate !== null);
    const plans = this.bestLiftPlans(candidates, gap);
    const lifts = candidates.map(() => false);
    let index = 0;
    while (index < candidates.length) {
      if (plans[index]!.liftsHere) {
        lifts[index] = true;
        index += gap + 1;
      } else {
        index++;
      }
    }
    return lifts;
  }

  /** For each index, the best plan over the segments from there to the end, built from the end. */
  private bestLiftPlans(candidates: ReadonlyArray<IsolationCandidate | null>, gap: number): LiftPlan[] {
    const none: LiftPlan = { secondsSaid: 0, liftCount: 0, liftsHere: false };
    const plans: LiftPlan[] = new Array<LiftPlan>(candidates.length + 1).fill(none);
    for (let index = candidates.length - 1; index >= 0; index--) {
      const skip: LiftPlan = { ...plans[index + 1]!, liftsHere: false };
      const candidate = candidates[index];
      if (!candidate) {
        plans[index] = skip;
        continue;
      }
      const rest = plans[Math.min(index + gap + 1, candidates.length)]!;
      const take: LiftPlan = {
        secondsSaid: candidate.secondsSaid + rest.secondsSaid,
        liftCount: rest.liftCount + 1,
        liftsHere: true,
      };
      plans[index] = this.isBetter(take, skip) ? take : skip;
    }
    return plans;
  }

  private isBetter(plan: LiftPlan, other: LiftPlan): boolean {
    const difference = plan.secondsSaid - other.secondsSaid;
    if (Math.abs(difference) > IsolatedWordLineSplitter.TIE_TOLERANCE) return difference > 0;
    return plan.liftCount > other.liftCount;
  }

  /** The word this segment would lift, or null when none qualifies. */
  private candidateIn(segment: Segment): IsolationCandidate | null {
    const words = segment.getWords();
    if (words.length === 0) return null;
    if (words.length < (this._config.minSegmentWords ?? 0)) return null;
    const leavesScreenAt = segment.time.end;
    const fits = (index: number): boolean => this.edgesFitPlace(segment, words, index);
    for (const condition of this._config.tagPriority ?? []) {
      const tagged = this.bestFound(words, leavesScreenAt, (word, index) => condition.evaluate(word.semanticTags) && fits(index));
      if (tagged !== null) return tagged;
    }
    return this.bestFound(words, leavesScreenAt, (word, index) => this.letterCount(word) >= this._config.minLetters && fits(index));
  }

  /** Whether the word at `index`, lifted, ends evenly on every side another line would sit. */
  private edgesFitPlace(segment: Segment, words: Word[], index: number): boolean {
    const limit = this._config.maxEdgeSpreadEm;
    if (limit === undefined || this.edgeReader === null) return true;
    const edges = this.edgeReader.edgesOf(words[index]!, segment);
    if (edges === null) return true;
    if (edges.topSpreadEm > limit && index !== 0) return false;
    if (edges.bottomSpreadEm > limit && index !== words.length - 1) return false;
    return true;
  }

  /** The word `matches` accepts on the strict time on screen, or failing that on the fallback time. */
  private bestFound(words: Word[], leavesScreenAt: number, matches: (word: Word, index: number) => boolean): IsolationCandidate | null {
    const strict = this.bestOnScreenFor(words, leavesScreenAt, this._config.minSecondsOnScreen, matches);
    if (strict !== null) return strict;
    const fallback = this._config.fallbackMinSecondsOnScreen;
    if (fallback === undefined || fallback >= this._config.minSecondsOnScreen) return null;
    return this.bestOnScreenFor(words, leavesScreenAt, fallback, matches);
  }

  /** Among the words that qualify on `minSecondsOnScreen`, the one `pickBy` prefers. */
  private bestOnScreenFor(
    words: Word[],
    leavesScreenAt: number,
    minSecondsOnScreen: number,
    matches: (word: Word, index: number) => boolean,
  ): IsolationCandidate | null {
    let best: IsolationCandidate | null = null;
    for (const index of this.indicesInSearchOrder(words.length)) {
      const word = words[index]!;
      if (leavesScreenAt - word.time.start < minSecondsOnScreen || !matches(word, index)) continue;
      if (this.leavesShortLine(words, index)) continue;
      const candidate = { index, secondsSaid: word.time.end - word.time.start };
      if (this._config.pickBy !== 'spoken-duration') return candidate;
      if (best === null || candidate.secondsSaid > best.secondsSaid + IsolatedWordLineSplitter.TIE_TOLERANCE) best = candidate;
    }
    return best;
  }

  /** Whether lifting the word at `index` would leave any line under `minLineChars`. */
  private leavesShortLine(words: Word[], index: number): boolean {
    const minLineChars = this._config.minLineChars;
    if (minLineChars === undefined) return false;
    const lines = [words.slice(0, index), [words[index]!], words.slice(index + 1)].filter((line) => line.length > 0);
    return lines.some((line) => this.paintedCharCount(line) < minLineChars);
  }

  private paintedCharCount(words: Word[]): number {
    const separators = Math.max(words.length - 1, 0);
    return words.reduce((sum, word) => sum + [...word.displayText].length, separators);
  }

  /**
   * Every index that can be isolated, the first only with `allowFirstWord`
   * and only the two ends with `onlyAtEnds`, in the order the search
   * visits them.
   */
  private indicesInSearchOrder(wordCount: number): number[] {
    const firstCandidate = this._config.allowFirstWord === true ? 0 : 1;
    const fromStart = Array.from({ length: Math.max(0, wordCount - firstCandidate) }, (_, offset) => offset + firstCandidate)
      .filter((index) => this._config.onlyAtEnds !== true || index === 0 || index === wordCount - 1);
    return this._config.searchFrom === 'start' ? fromStart : fromStart.reverse();
  }

  private letterCount(word: Word): number {
    return word.text.match(LETTER_PATTERN)?.length ?? 0;
  }
}
