import type { SegmentSplitter } from '@modules/splitting/SegmentSplitter';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';

export interface BoundaryScoreLimitByCharsConfig {
  maxChars: number;
  minChars: number;
}

/**
 * Splits segments by character count, keeping each chunk between
 * `minChars` and `maxChars` when possible. Among the cut positions
 * that satisfy both bounds, the one after the word with the highest
 * `boundaryScore` wins — cuts land where an external scorer marked a
 * strong boundary. When no word in the valid range carries a score,
 * the splitter falls back to the greedy behaviour: grow the chunk to
 * the maximum and retreat only enough to keep the tail above
 * `minChars`.
 *
 * When the residual tail is too short to satisfy both bounds on its
 * own, its words are absorbed into the current chunk as a last
 * resort.
 */
export class BoundaryScoreLimitByCharsSegmentSplitter implements SegmentSplitter {
  constructor(private readonly _config: BoundaryScoreLimitByCharsConfig) {}

  split(segments: ReadonlyArray<Segment>): Segment[] {
    return segments.flatMap((segment) => this.splitSegment(segment));
  }

  private splitSegment(segment: Segment): Segment[] {
    const words = segment.getWords();
    const n = words.length;
    if (n === 0) return [];

    const result: Segment[] = [];
    let start = 0;
    while (start < n) {
      const end = this.pickCut(words, start);
      result.push(new Segment({ lines: [new Line({ words: words.slice(start, end) })] }));
      start = end;
    }
    return result;
  }

  private pickCut(words: readonly Word[], start: number): number {
    const n = words.length;
    const kHigh = this.largestCutWithinMax(words, start);
    if (kHigh === n) return n;

    const kLow = this.smallestCutMeetingMin(words, start, kHigh);
    if (kLow > kHigh) return kHigh;

    const candidates = this.cutsPreservingTail(words, kLow, kHigh);
    if (candidates.length === 0) return n;

    return this.highestScoredCut(words, candidates);
  }

  private largestCutWithinMax(words: readonly Word[], start: number): number {
    const { maxChars } = this._config;
    const n = words.length;
    let end = start + 1;
    while (end < n && this.weight(words, start, end + 1) <= maxChars) end++;
    return end;
  }

  private smallestCutMeetingMin(words: readonly Word[], start: number, upperBound: number): number {
    const { minChars } = this._config;
    let k = start + 1;
    while (k <= upperBound && this.weight(words, start, k) < minChars) k++;
    return k;
  }

  private cutsPreservingTail(words: readonly Word[], kLow: number, kHigh: number): number[] {
    const { minChars } = this._config;
    const n = words.length;
    const candidates: number[] = [];
    for (let k = kLow; k <= kHigh; k++) {
      if (this.weight(words, k, n) >= minChars) candidates.push(k);
    }
    return candidates;
  }

  private highestScoredCut(words: readonly Word[], candidates: readonly number[]): number {
    let best = candidates[candidates.length - 1]!;
    let bestScore = -Infinity;
    for (const k of candidates) {
      const score = words[k - 1]!.boundaryScore;
      if (score === null) continue;
      if (score > bestScore || (score === bestScore && k > best)) {
        bestScore = score;
        best = k;
      }
    }
    return best;
  }

  private weight(words: readonly Word[], from: number, to: number): number {
    if (to <= from) return 0;
    let chars = to - from - 1;
    for (let k = from; k < to; k++) chars += words[k]!.text.length;
    return chars;
  }
}
