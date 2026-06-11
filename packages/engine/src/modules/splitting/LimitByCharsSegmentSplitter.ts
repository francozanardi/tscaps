import type { SegmentSplitter } from '@modules/splitting/SegmentSplitter';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';

export interface LimitByCharsConfig {
  maxChars: number;
  minChars: number;
  minDuration: number;
  minLastWordDuration: number;
}

// Splits segments so that no segment exceeds `maxChars` characters.
// If the remaining words after a cut would be fewer than `minChars` characters,
// or their total duration would be less than `minDuration` seconds, they are
// absorbed into the current segment instead of forming a new one.
// `minLastWordDuration` (seconds) protects templates that reveal words as they
// are narrated: when the chunk's tail word would be on screen for less than
// the threshold, the cut is deferred forward one word at a time until the
// tail can stay long enough to be readable. Defaults to 0 (off).
export class LimitByCharsSegmentSplitter implements SegmentSplitter {
  constructor(private readonly _config: LimitByCharsConfig) {}

  split(segments: ReadonlyArray<Segment>): Segment[] {
    return segments.flatMap((segment) => this.splitSegment(segment));
  }

  private splitSegment(segment: Segment): Segment[] {
    const { maxChars, minChars, minDuration, minLastWordDuration } = this._config;
    const words = segment.getWords();
    const result: Segment[] = [];
    let currentChunk: typeof words = [];
    let currentLength = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i]!;
      const addedLength = currentLength === 0 ? word.text.length : word.text.length + 1;

      if (currentLength + addedLength > maxChars && currentChunk.length > 0) {
        // Defer the cut while the chunk's tail word's narration is too short
        // to read. Each extra word pushed in becomes the new tail and gets
        // re-evaluated against the threshold.
        let nextIndex = i;
        while (
          nextIndex < words.length &&
          currentChunk[currentChunk.length - 1]!.time.duration < minLastWordDuration
        ) {
          currentChunk.push(words[nextIndex]!);
          nextIndex++;
        }
        if (nextIndex >= words.length) break;

        const remaining = words.slice(nextIndex);
        const remainingChars = remaining.reduce((sum, w) => sum + w.text.length, 0);
        const remainingDuration = remaining[remaining.length - 1]!.time.end - remaining[0]!.time.start;
        if (remainingChars < minChars || remainingDuration < minDuration) {
          currentChunk.push(...remaining);
          break;
        }
        result.push(new Segment({ lines: [new Line({ words: currentChunk })] }));
        const startWord = words[nextIndex]!;
        currentChunk = [startWord];
        currentLength = startWord.text.length;
        i = nextIndex;
      } else {
        currentChunk.push(word);
        currentLength += addedLength;
      }
    }

    if (currentChunk.length > 0) {
      result.push(new Segment({ lines: [new Line({ words: currentChunk })] }));
    }

    return result;
  }
}
