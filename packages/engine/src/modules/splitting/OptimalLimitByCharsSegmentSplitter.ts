import type { SegmentSplitter } from '@modules/splitting/SegmentSplitter';
import type { CutScorer } from '@modules/splitting/CutScorer';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';

export interface OptimalLimitByCharsConfig {
  maxChars: number;
  minChars: number;
  /**
   * What each cut costs, on the cut scorer's scale. Every split pays it
   * once per cut, so it only weighs in when splits differ in how many
   * chunks they make: a cut the bounds do not require is added only
   * when it rates higher than this.
   */
  cutCost: number;
}

/**
 * The best way found so far to split the words from one index to the
 * end: its total, and where its first chunk ends.
 */
interface SuffixSplit {
  readonly total: number;
  readonly firstChunkEnd: number;
}

/**
 * Splits segments by character count, choosing every cut of a segment
 * together rather than one chunk at a time. Each chunk must hold between
 * `minChars` and `maxChars`; a single word longer than `maxChars` may
 * stand alone, and a segment shorter than `minChars` stays whole. Among
 * the splits that respect the bounds, the one with the highest total
 * wins, the total being each cut's rating from the cut scorer (null
 * counts as 0) minus `cutCost` per cut. So a strong cut can pull the
 * cuts around it into place, and the split never has more chunks than
 * the bounds require unless a cut rates above `cutCost`.
 *
 * Between splits of equal total, the one whose chunks come out longest
 * first wins, which with no ratings at all is the greedy split. When no
 * split respects the bounds, the segment goes to the fallback splitter.
 */
export class OptimalLimitByCharsSegmentSplitter implements SegmentSplitter {
  // Totals are sums of floating-point ratings; differences below this are ties.
  private static readonly TIE_TOLERANCE = 1e-9;

  constructor(
    private readonly _config: OptimalLimitByCharsConfig,
    private readonly _cutScorer: CutScorer,
    private readonly _fallback: SegmentSplitter,
  ) {}

  split(segments: ReadonlyArray<Segment>): Segment[] {
    return segments.flatMap((segment) => this.splitSegment(segment));
  }

  private splitSegment(segment: Segment): Segment[] {
    const words = segment.getWords();
    if (words.length === 0) return [];

    const best = this.bestSplitsOfEverySuffix(words);
    if (!best[0]) return this._fallback.split([segment]);
    return this.chunksOf(words, best);
  }

  /**
   * For each start index, the best split of the words from there to the
   * end, or null when none respects the bounds. Built from the end so
   * that each entry reuses the ones after it.
   */
  private bestSplitsOfEverySuffix(words: readonly Word[]): (SuffixSplit | null)[] {
    const n = words.length;
    const best: (SuffixSplit | null)[] = new Array<SuffixSplit | null>(n + 1).fill(null);
    best[n] = { total: 0, firstChunkEnd: n };

    for (let start = n - 1; start >= 0; start--) {
      for (let end = start + 1; end <= n && this.mayEndAt(words, start, end); end++) {
        const rest = best[end] ?? null;
        if (rest === null || !this.isChunkAllowed(words, start, end)) continue;
        const total = this.cutValue(words, end) + rest.total;
        const current = best[start] ?? null;
        // Ends are tried in increasing order, so a tie goes to the later one.
        if (current === null || total >= current.total - OptimalLimitByCharsSegmentSplitter.TIE_TOLERANCE) {
          best[start] = { total, firstChunkEnd: end };
        }
      }
    }
    return best;
  }

  /** Whether a chunk from `start` could still end at `end`: past the maximum, only a lone word can. */
  private mayEndAt(words: readonly Word[], start: number, end: number): boolean {
    return end === start + 1 || this.weight(words, start, end) <= this._config.maxChars;
  }

  private isChunkAllowed(words: readonly Word[], start: number, end: number): boolean {
    const isWholeSegment = start === 0 && end === words.length;
    return isWholeSegment || this.weight(words, start, end) >= this._config.minChars;
  }

  /** What ending a chunk before `words[end]` adds to the total; nothing at the segment's end. */
  private cutValue(words: readonly Word[], end: number): number {
    if (end === words.length) return 0;
    return (this._cutScorer.scoreCutBefore(words, end) ?? 0) - this._config.cutCost;
  }

  private chunksOf(words: readonly Word[], best: readonly (SuffixSplit | null)[]): Segment[] {
    const chunks: Segment[] = [];
    let start = 0;
    while (start < words.length) {
      const end = best[start]!.firstChunkEnd;
      chunks.push(new Segment({ lines: [new Line({ words: words.slice(start, end) })] }));
      start = end;
    }
    return chunks;
  }

  private weight(words: readonly Word[], from: number, to: number): number {
    if (to <= from) return 0;
    let chars = to - from - 1;
    for (let k = from; k < to; k++) chars += words[k]!.text.length;
    return chars;
  }
}
