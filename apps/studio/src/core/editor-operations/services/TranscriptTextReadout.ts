import type { Document, Word } from '@tscaps/engine';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';

// How often a line of text starts with its time: often enough to place a moment, rare enough to stay text.
const SECONDS_PER_LINE = 10;

/**
 * What the captions say, as plain text: a line about every ten seconds,
 * each opening with the time of its first word (`[12.4 s] …`), and no
 * refs. Lines start at a word, never at a caption, so how captions are
 * split (which a template decides) does not change it.
 */
export class TranscriptTextReadout {
  constructor(private readonly format: ReadoutFormatter) {}

  textOf(document: Document, fromSec: number, toSec: number): string {
    const lines: string[] = [];
    let line: Word[] = [];
    for (const word of this.wordsBetween(document, fromSec, toSec)) {
      const lineStart = line[0]?.time.start;
      if (lineStart !== undefined && word.time.start >= lineStart + SECONDS_PER_LINE) {
        lines.push(this.lineOf(line));
        line = [];
      }
      line.push(word);
    }
    if (line.length > 0) lines.push(this.lineOf(line));
    return lines.join('\n');
  }

  private wordsBetween(document: Document, fromSec: number, toSec: number): Word[] {
    return document.sections
      .flatMap((section) => section.segments.flatMap((segment) => segment.getWords()))
      .filter((word) => word.time.end > fromSec && word.time.start < toSec)
      .sort((first, second) => first.time.start - second.time.start);
  }

  private lineOf(words: ReadonlyArray<Word>): string {
    return `[${this.format.sec(words[0]!.time.start)} s] ${words.map((word) => word.text).join(' ')}`;
  }
}
