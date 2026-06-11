import type { SegmentSplitter } from '@modules/splitting/SegmentSplitter';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';

export interface LimitByScaledCharsConfig {
  maxChars: number;
  minChars: number;
  scale: number;
}

/**
 * Splits segments by character count weighted by a scaling factor: each
 * character contributes `scale` to a running budget and the segment is cut
 * so that no chunk exceeds `maxChars`. When the tail left after a greedy
 * cut would weigh less than `minChars`, the current chunk is shrunk word
 * by word until the tail reaches `minChars` — provided the current chunk
 * stays at or above `minChars` itself. Only when both bounds cannot be
 * honoured at once (e.g. the remaining text is shorter than two
 * `minChars` blocks) are the residual words absorbed into the current
 * chunk as a last resort.
 *
 * At `scale = 1` the behaviour is identical to a plain character-count
 * limit. A higher `scale` shrinks the effective capacity proportionally,
 * which lets callers express "how much text per segment" once and have it
 * adapt to whatever rendered size the text ends up at.
 */
export class LimitByScaledCharsSegmentSplitter implements SegmentSplitter {
  constructor(private readonly _config: LimitByScaledCharsConfig) {}

  split(segments: ReadonlyArray<Segment>): Segment[] {
    return segments.flatMap((segment) => this.splitSegment(segment));
  }

  private splitSegment(segment: Segment): Segment[] {
    const { maxChars, minChars, scale } = this._config;
    const words = segment.getWords();
    const n = words.length;
    if (n === 0) return [];

    const weight = (from: number, to: number): number => {
      if (to <= from) return 0;
      let chars = to - from - 1;
      for (let k = from; k < to; k++) chars += words[k]!.text.length;
      return chars * scale;
    };

    const result: Segment[] = [];
    let start = 0;

    while (start < n) {
      let end = start + 1;
      while (end < n && weight(start, end + 1) <= maxChars) end++;

      if (end === n) {
        result.push(new Segment({ lines: [new Line({ words: words.slice(start, end) })] }));
        break;
      }

      while (
        weight(end, n) < minChars &&
        end > start + 1 &&
        weight(start, end - 1) >= minChars
      ) {
        end--;
      }

      if (weight(end, n) < minChars) {
        result.push(new Segment({ lines: [new Line({ words: words.slice(start, n) })] }));
        break;
      }

      result.push(new Segment({ lines: [new Line({ words: words.slice(start, end) })] }));
      start = end;
    }

    return result;
  }
}
