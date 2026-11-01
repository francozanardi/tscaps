import type { LineSplitter } from '@modules/splitting/LineSplitter';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';
import type { TagCondition } from '@modules/tags/TagCondition';

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
}

export type IsolatedWordSearchFrom = 'end' | 'start';

const LETTER_PATTERN = /[\p{L}\p{N}]/gu;

/**
 * Lifts one word of each segment onto a line of its own, always the
 * second line, so a stylesheet can address it as such.
 *
 * The word is the latest one that has enough letters and stays on
 * screen long enough to be read. How fast it is said does not matter,
 * only how long it is shown: from the moment it is said until the
 * segment's `time` ends. That is the time the segment is shown for, so
 * run this after whatever shapes it — an effect holding a segment past
 * its last word, a time set by hand — or the word is judged on the
 * speech alone. The first word never qualifies, since the line above it
 * would be empty. `tagPriority` tries tags before the letters, and
 * `searchFrom` can take the earliest word instead of the latest.
 *
 * The result is one of three shapes:
 *
 * - the words before it, then the word — when the last word qualifies;
 * - the words before it, the word, then the words after it;
 * - every word on one line, when none qualifies.
 *
 * So a segment of two or more lines always has exactly one word on its
 * second line.
 */
export class IsolatedWordLineSplitter implements LineSplitter {

  constructor(private readonly _config: IsolatedWordLineSplitterConfig) {}

  split(segments: ReadonlyArray<Segment>): Segment[] {
    return segments.map((segment) => this.splitSegment(segment));
  }

  private splitSegment(segment: Segment): Segment {
    const words = segment.getWords();
    if (words.length === 0) return segment;
    const isolatedIndex = this.isolatedWordIndex(words, segment.time.end);
    if (isolatedIndex === null) return segment.with({ lines: [new Line({ words })] });
    const lines = [
      new Line({ words: words.slice(0, isolatedIndex) }),
      new Line({ words: [words[isolatedIndex]!] }),
    ];
    const after = words.slice(isolatedIndex + 1);
    if (after.length > 0) lines.push(new Line({ words: after }));
    return segment.with({ lines });
  }

  private isolatedWordIndex(words: Word[], leavesScreenAt: number): number | null {
    for (const condition of this._config.tagPriority ?? []) {
      const tagged = this.firstFound(words, leavesScreenAt, (word) => condition.evaluate(word.semanticTags));
      if (tagged !== null) return tagged;
    }
    return this.firstFound(words, leavesScreenAt, (word) => this.letterCount(word) >= this._config.minLetters);
  }

  /** The first word `matches` accepts on the strict time on screen, or failing that on the fallback time. */
  private firstFound(words: Word[], leavesScreenAt: number, matches: (word: Word) => boolean): number | null {
    const strict = this.firstOnScreenFor(words, leavesScreenAt, this._config.minSecondsOnScreen, matches);
    if (strict !== null) return strict;
    const fallback = this._config.fallbackMinSecondsOnScreen;
    if (fallback === undefined || fallback >= this._config.minSecondsOnScreen) return null;
    return this.firstOnScreenFor(words, leavesScreenAt, fallback, matches);
  }

  private firstOnScreenFor(
    words: Word[],
    leavesScreenAt: number,
    minSecondsOnScreen: number,
    matches: (word: Word) => boolean,
  ): number | null {
    for (const index of this.indicesInSearchOrder(words.length)) {
      const word = words[index]!;
      if (matches(word) && leavesScreenAt - word.time.start >= minSecondsOnScreen) return index;
    }
    return null;
  }

  /** Every index but the first, in the order the search visits them. */
  private indicesInSearchOrder(wordCount: number): number[] {
    const fromStart = Array.from({ length: Math.max(0, wordCount - 1) }, (_, offset) => offset + 1);
    return this._config.searchFrom === 'start' ? fromStart : fromStart.reverse();
  }

  private letterCount(word: Word): number {
    return word.text.match(LETTER_PATTERN)?.length ?? 0;
  }
}
