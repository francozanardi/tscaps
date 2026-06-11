import type { SegmentSplitter } from '@modules/splitting/SegmentSplitter';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';

export interface LimitByWordsConfig {
  maxWords: number;
}

// Splits segments so that no segment has more than `maxWords` words.
export class LimitByWordsSegmentSplitter implements SegmentSplitter {
  constructor(private readonly _config: LimitByWordsConfig) {}

  split(segments: ReadonlyArray<Segment>): Segment[] {
    return segments.flatMap((segment) => this.splitSegment(segment));
  }

  private splitSegment(segment: Segment): Segment[] {
    const { maxWords } = this._config;
    const words = segment.getWords();
    if (words.length <= maxWords) return [segment];

    const result: Segment[] = [];
    for (let i = 0; i < words.length; i += maxWords) {
      const chunk = words.slice(i, i + maxWords) as Word[];
      result.push(new Segment({ lines: [new Line({ words: chunk })] }));
    }
    return result;
  }
}
