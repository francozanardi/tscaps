import type { LineSplitter } from '@modules/splitting/LineSplitter';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import type { TextMeasurer } from '@modules/splitting/TextMeasurer';

export interface BalancedPixelWidthLineSplitterConfig {
  maxLines: number;
  minLines: number;
  maxWidth: number;
}

/**
 * Cached per-word widths plus the inter-word space width for a single
 * segment. Anchors all subsequent range queries to O(1) arithmetic.
 *
 * `wordWidthPrefixSums[i]` is the sum of widths of the first `i` words —
 * `[0] = 0`, `[N] = total`. Width of `words[a..b]` (inclusive) rendered
 * alone on a line is `prefixSums[b+1] - prefixSums[a] + (b-a) * spaceWidth`.
 */
interface SegmentMeasurements {
  wordWidthPrefixSums: number[];
  spaceWidth: number;
}

/**
 * Greedy first pass picks the minimum number of lines that fit `maxWidth`,
 * then a recursive split balances widths across that target. Width queries
 * are delegated to a `TextMeasurer`, so this class stays purely arithmetic
 * and the consumer chooses how widths are resolved (DOM probe, canvas,
 * lookup, etc.).
 */
export class BalancedPixelWidthLineSplitter implements LineSplitter {
  constructor(
    private readonly _config: BalancedPixelWidthLineSplitterConfig,
    private readonly _measurer: TextMeasurer,
  ) {}

  split(segments: ReadonlyArray<Segment>): Segment[] {
    return segments.map((segment) => {
      const words = segment.getWords();
      if (words.length === 0) return segment;
      const m = this.buildMeasurements(words);
      const lines = this.buildLines(words, m);
      this.adjustToMinLines(lines);
      return segment.with({ lines });
    });
  }

  private buildMeasurements(words: Word[]): SegmentMeasurements {
    const prefixSums = new Array<number>(words.length + 1);
    prefixSums[0] = 0;
    for (let i = 0; i < words.length; i++) {
      prefixSums[i + 1] = prefixSums[i]! + this._measurer.measure(words[i]!.text);
    }
    return { wordWidthPrefixSums: prefixSums, spaceWidth: this._measurer.spaceWidth() };
  }

  /**
   * Width of `words[a..b]` (inclusive, in original segment indices) rendered
   * alone on a line: sum of word widths plus one inter-word gap per pair.
   */
  private rangeWidth(m: SegmentMeasurements, a: number, b: number): number {
    return m.wordWidthPrefixSums[b + 1]! - m.wordWidthPrefixSums[a]! + (b - a) * m.spaceWidth;
  }

  private buildLines(words: Word[], m: SegmentMeasurements): Line[] {
    const { maxLines } = this._config;

    // Greedy pass to find the minimum number of lines needed
    let linesNeeded = 1;
    let lineStart = 0;
    for (let i = 1; i < words.length; i++) {
      const width = this.rangeWidth(m, lineStart, i);
      if (width > this._config.maxWidth && i > lineStart) {
        linesNeeded++;
        lineStart = i;
      }
    }

    const targetLines = Math.min(linesNeeded, maxLines);
    if (targetLines <= 1) return [new Line({ words })];

    return this.splitRecursive(words, targetLines, m, 0);
  }

  private splitRecursive(words: Word[], linesLeft: number, m: SegmentMeasurements, offset: number): Line[] {
    if (linesLeft <= 1 || words.length === 0) {
      return words.length > 0 ? [new Line({ words })] : [];
    }

    const totalWidth = this.rangeWidth(m, offset, offset + words.length - 1);
    const target = totalWidth / linesLeft;

    let bestSplit = 1;
    let bestDiff = Infinity;

    for (let i = 0; i < words.length - 1; i++) {
      const cumWidth = this.rangeWidth(m, offset, offset + i);
      const diff = Math.abs(cumWidth - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestSplit = i + 1;
      }
    }

    return [
      new Line({ words: words.slice(0, bestSplit) }),
      ...this.splitRecursive(words.slice(bestSplit), linesLeft - 1, m, offset + bestSplit),
    ];
  }

  private adjustToMinLines(lines: Line[]): void {
    const { minLines } = this._config;
    while (lines.length < minLines) {
      let longestIdx = 0;
      for (let i = 1; i < lines.length; i++) {
        if ((lines[i]?.words.length ?? 0) > (lines[longestIdx]?.words.length ?? 0)) {
          longestIdx = i;
        }
      }
      const longest = lines[longestIdx];
      if (!longest || longest.words.length <= 1) break;
      const mid = Math.floor(longest.words.length / 2);
      const first = new Line({ words: [...longest.words].slice(0, mid) });
      const second = new Line({ words: [...longest.words].slice(mid) });
      lines.splice(longestIdx, 1, first, second);
    }
  }
}
