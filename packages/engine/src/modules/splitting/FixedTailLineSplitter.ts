import type { LineSplitter } from '@modules/splitting/LineSplitter';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';

export interface FixedTailLineSplitterConfig {
  /**
   * Word count reserved for the second (tail) line. Honored only when the
   * segment carries strictly more words than this value; otherwise the
   * splitter falls back to a one-word head and a tail with the rest, so
   * neither line is empty.
   */
  readonly tailWordCount: number;
  /**
   * Fewest words a segment needs before it is split at all; shorter
   * segments stay on one line. At least 2. Defaults to 3.
   */
  readonly minWordsToSplit?: number | undefined;
}

/**
 * Splits each segment into exactly two lines when possible: the head line
 * receives every word except the last `tailWordCount`, and the tail line
 * receives those final words. Segments with fewer than `minWordsToSplit`
 * words stay on a single line; longer segments with no more than
 * `tailWordCount` words fall back to one word on the head and the
 * remainder on the tail, so neither line ends up empty.
 */
export class FixedTailLineSplitter implements LineSplitter {
  private static readonly DEFAULT_MIN_WORDS_TO_SPLIT = 3;
  // One word cannot be split into two non-empty lines.
  private static readonly LOWEST_MIN_WORDS_TO_SPLIT = 2;

  private readonly minWordsToSplit: number;

  constructor(private readonly _config: FixedTailLineSplitterConfig) {
    this.minWordsToSplit = Math.max(
      FixedTailLineSplitter.LOWEST_MIN_WORDS_TO_SPLIT,
      _config.minWordsToSplit ?? FixedTailLineSplitter.DEFAULT_MIN_WORDS_TO_SPLIT,
    );
  }

  split(segments: ReadonlyArray<Segment>): Segment[] {
    return segments.map((segment) => this.splitSegment(segment));
  }

  private splitSegment(segment: Segment): Segment {
    const words = segment.getWords();
    if (words.length === 0) return segment;
    const lines = this.buildLines(words);
    return segment.with({ lines });
  }

  private buildLines(words: Word[]): Line[] {
    if (words.length < this.minWordsToSplit) {
      return [new Line({ words })];
    }
    const splitAt = this.headSize(words.length);
    return [
      new Line({ words: words.slice(0, splitAt) }),
      new Line({ words: words.slice(splitAt) }),
    ];
  }

  private headSize(totalWords: number): number {
    if (totalWords > this._config.tailWordCount) {
      return totalWords - this._config.tailWordCount;
    }
    return 1;
  }
}
