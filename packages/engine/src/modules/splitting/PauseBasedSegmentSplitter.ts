import type { SegmentSplitter } from '@modules/splitting/SegmentSplitter';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';

export interface PauseBasedConfig {
  /**
   * Minimum gap, in seconds, between the end of one word and the start of
   * the next that triggers a segment cut. Pauses below this threshold are
   * left inside the current segment.
   */
  minGap: number;
}

/**
 * Splits segments at audible pauses between consecutive words. The cut is
 * placed wherever the gap between the previous word's `end` and the next
 * word's `start` exceeds `minGap`. This is the coarsest segmentation step:
 * it lets downstream splitters (boundary, char/word limits) refine the
 * pause-bounded chunks without ever merging across a real pause.
 */
export class PauseBasedSegmentSplitter implements SegmentSplitter {
  constructor(private readonly _config: PauseBasedConfig) {}

  split(segments: ReadonlyArray<Segment>): Segment[] {
    return segments.flatMap((segment) => this.splitSegment(segment));
  }

  private splitSegment(segment: Segment): Segment[] {
    const words = segment.getWords();
    if (words.length <= 1) return [segment];

    const { minGap } = this._config;
    const result: Segment[] = [];
    let currentChunk: typeof words = [words[0]!];

    for (let i = 1; i < words.length; i++) {
      const prev = words[i - 1]!;
      const word = words[i]!;
      const gap = word.time.start - prev.time.end;
      if (gap >= minGap) {
        result.push(new Segment({ lines: [new Line({ words: currentChunk })] }));
        currentChunk = [word];
      } else {
        currentChunk.push(word);
      }
    }

    if (currentChunk.length > 0) {
      result.push(new Segment({ lines: [new Line({ words: currentChunk })] }));
    }

    return result.length > 0 ? result : [segment];
  }
}
