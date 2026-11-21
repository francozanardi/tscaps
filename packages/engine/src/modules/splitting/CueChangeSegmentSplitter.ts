import type { SegmentSplitter } from '@modules/splitting/SegmentSplitter';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';

/**
 * Splits each segment between two consecutive words read from different
 * cues of a caption file (`Word.cueIndex`), so no segment holds words of
 * two cues. A word with no cue never causes a cut: a word added later
 * between two of the same cue stays with them, and a document with no
 * cues at all passes through untouched.
 *
 * When `enabled` is false the splitter is a no-op.
 */
export class CueChangeSegmentSplitter implements SegmentSplitter {
  constructor(private readonly enabled: boolean) {}

  split(segments: ReadonlyArray<Segment>): Segment[] {
    if (!this.enabled) return [...segments];
    return segments.flatMap((segment) => this.splitOne(segment));
  }

  private splitOne(segment: Segment): Segment[] {
    const words = segment.getWords();
    if (words.length <= 1) return [segment];

    const chunks: Word[][] = [];
    let current: Word[] = [words[0]!];
    let currentCue = words[0]!.cueIndex;

    for (let i = 1; i < words.length; i++) {
      const word = words[i]!;
      if (this.startsAnotherCue(currentCue, word.cueIndex)) {
        chunks.push(current);
        current = [word];
      } else {
        current.push(word);
      }
      if (word.cueIndex !== null) currentCue = word.cueIndex;
    }
    chunks.push(current);

    if (chunks.length <= 1) return [segment];
    return chunks.map((chunk) => new Segment({ lines: [new Line({ words: chunk })] }));
  }

  private startsAnotherCue(currentCue: number | null, wordCue: number | null): boolean {
    return currentCue !== null && wordCue !== null && wordCue !== currentCue;
  }
}
