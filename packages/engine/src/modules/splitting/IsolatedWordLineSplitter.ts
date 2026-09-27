import type { LineSplitter } from '@modules/splitting/LineSplitter';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';

export interface IsolatedWordLineSplitterConfig {
  /**
   * Fewest letters a word needs to stand on a line of its own. Counted
   * per letter, so in scripts that write a word in one or two characters
   * few words reach it.
   */
  readonly minLetters: number;
  /**
   * Least time, in seconds, a word must stay on screen — from the moment
   * it is said to the moment its caption leaves — to stand on its own line.
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
   * How long a caption stays up after its last word, at most, when
   * nothing replaces it sooner. The next segment's start always cuts it
   * short. `0` when captions leave with their last word.
   */
  readonly holdAfterLastWordSeconds: number;
}

const LETTER_PATTERN = /[\p{L}\p{N}]/gu;

/**
 * Lifts one word of each segment onto a line of its own, always the
 * second line, so a stylesheet can address it as such.
 *
 * The word is the latest one that has enough letters and stays on
 * screen long enough to be read. How fast it is said does not matter,
 * only how long it is shown: from the moment it is said until the next
 * segment starts, or `holdAfterLastWordSeconds` after the last word,
 * whichever comes first. The first word never qualifies, since the line
 * above it would be empty. Segments are taken to arrive in the order
 * they play.
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
    return segments.map((segment, index) =>
      this.splitSegment(segment, this.leavesScreenAt(segment, segments[index + 1])));
  }

  private leavesScreenAt(segment: Segment, next: Segment | undefined): number {
    const held = segment.time.end + this._config.holdAfterLastWordSeconds;
    if (next === undefined) return held;
    return Math.max(segment.time.end, Math.min(held, next.time.start));
  }

  private splitSegment(segment: Segment, leavesScreenAt: number): Segment {
    const words = segment.getWords();
    if (words.length === 0) return segment;
    const isolatedIndex = this.isolatedWordIndex(words, leavesScreenAt);
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
    const preferred = this.latestStandingAlone(words, leavesScreenAt, this._config.minSecondsOnScreen);
    if (preferred !== null) return preferred;
    const fallback = this._config.fallbackMinSecondsOnScreen;
    if (fallback === undefined || fallback >= this._config.minSecondsOnScreen) return null;
    return this.latestStandingAlone(words, leavesScreenAt, fallback);
  }

  private latestStandingAlone(words: Word[], leavesScreenAt: number, minSecondsOnScreen: number): number | null {
    for (let index = words.length - 1; index > 0; index--) {
      if (this.canStandAlone(words[index]!, leavesScreenAt, minSecondsOnScreen)) return index;
    }
    return null;
  }

  private canStandAlone(word: Word, leavesScreenAt: number, minSecondsOnScreen: number): boolean {
    if (this.letterCount(word) < this._config.minLetters) return false;
    return leavesScreenAt - word.time.start >= minSecondsOnScreen;
  }

  private letterCount(word: Word): number {
    return word.text.match(LETTER_PATTERN)?.length ?? 0;
  }
}
