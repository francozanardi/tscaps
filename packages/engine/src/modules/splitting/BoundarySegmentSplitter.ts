import type { SegmentSplitter } from '@modules/splitting/SegmentSplitter';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';

export interface BoundaryConfig {
  separators: string[];
}

/**
 * Splits segments at hard boundary characters (e.g. sentence-ending
 * punctuation, optional clause separators). Boundaries chosen here are
 * never crossed by downstream segment splitters, so this step decides
 * which punctuation acts as a "do not merge across" marker. Operates on
 * the segments of a single Section.
 */
export class BoundarySegmentSplitter implements SegmentSplitter {
  private readonly _separators: ReadonlySet<string>;

  constructor(config: BoundaryConfig) {
    this._separators = new Set(config.separators);
  }

  split(segments: ReadonlyArray<Segment>): Segment[] {
    return segments.flatMap((segment) => this.splitSegment(segment));
  }

  private splitSegment(segment: Segment): Segment[] {
    if (this._separators.size === 0) return [segment];

    const words = segment.getWords();
    const result: Segment[] = [];
    let currentChunk: typeof words = [];

    for (const word of words) {
      currentChunk.push(word);
      const endsWithSeparator = Array.from(this._separators).some((sep) => word.text.endsWith(sep));
      if (endsWithSeparator) {
        result.push(new Segment({ lines: [new Line({ words: currentChunk })] }));
        currentChunk = [];
      }
    }

    if (currentChunk.length > 0) {
      result.push(new Segment({ lines: [new Line({ words: currentChunk })] }));
    }

    return result.length > 0 ? result : [segment];
  }
}
