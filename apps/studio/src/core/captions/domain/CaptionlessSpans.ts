import type { Word } from '@tscaps/engine';
import type { CaptionlessSpan } from '@core/captions/domain/CaptionlessSpan';

// Shots open at a word's start; a word starting a hair before its shot, by rounding, still belongs to it.
const EDGE_SEC = 0.001;

/**
 * The stretches where captions are kept off, read against words: a word
 * is inside one when it starts there.
 */
export class CaptionlessSpans {
  constructor(private readonly spans: ReadonlyArray<CaptionlessSpan>) {}

  isEmpty(): boolean {
    return this.spans.length === 0;
  }

  /** Where each stretch starts, in seconds. */
  startsSec(): number[] {
    return this.spans.map((span) => span.startSec);
  }

  /** Whether every one of `words` is inside a stretch; false for none. */
  cover(words: ReadonlyArray<Word>): boolean {
    return words.length > 0 && words.every((word) => this.spanIndexOf(word) !== -1);
  }

  /**
   * `words` in runs that never cross a stretch's edge: consecutive words
   * inside the same stretch, or outside all of them, stay together, in
   * order. Empty for no words.
   */
  runsOf(words: ReadonlyArray<Word>): Word[][] {
    const runs: Word[][] = [];
    let current: Word[] = [];
    let currentSpan: number | null = null;
    for (const word of words) {
      const span = this.spanIndexOf(word);
      if (currentSpan !== null && span !== currentSpan) {
        runs.push(current);
        current = [];
      }
      current.push(word);
      currentSpan = span;
    }
    if (current.length > 0) runs.push(current);
    return runs;
  }

  private spanIndexOf(word: Word): number {
    const start = word.time.start;
    return this.spans.findIndex((span) => start >= span.startSec - EDGE_SEC && start < span.endSec - EDGE_SEC);
  }
}
