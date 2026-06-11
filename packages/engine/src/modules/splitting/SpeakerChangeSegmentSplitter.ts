import type { SegmentSplitter } from '@modules/splitting/SegmentSplitter';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';

/**
 * Splits each segment wherever consecutive words carry a different
 * `speakerId`. Words with `speakerId === null` form their own group, so
 * mixed documents still produce clean mono-speaker boundaries.
 *
 * When `enabled` is false the splitter is a no-op — useful for callers
 * that intentionally keep multi-speaker words in a single segment.
 */
export class SpeakerChangeSegmentSplitter implements SegmentSplitter {
  constructor(private readonly enabled: boolean) {}

  split(segments: ReadonlyArray<Segment>): Segment[] {
    if (!this.enabled) return [...segments];
    return segments.flatMap((segment) => this._splitOne(segment));
  }

  private _splitOne(segment: Segment): Segment[] {
    const words = segment.getWords();
    if (words.length <= 1) return [segment];

    const chunks: Word[][] = [];
    let current: Word[] = [words[0]!];
    let currentSpeaker = words[0]!.speakerId;

    for (let i = 1; i < words.length; i++) {
      const word = words[i]!;
      if (word.speakerId !== currentSpeaker) {
        chunks.push(current);
        current = [word];
        currentSpeaker = word.speakerId;
      } else {
        current.push(word);
      }
    }
    if (current.length > 0) chunks.push(current);

    if (chunks.length <= 1) return [segment];
    return chunks.map((chunk) => new Segment({ lines: [new Line({ words: chunk })] }));
  }
}
