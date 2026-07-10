import { TimeFragment, Word } from '@tscaps/engine';

/**
 * Collapses overlaps between consecutive words so each word ends no later
 * than the next word begins. Some transcribers report a word's `end`
 * past the `start` of one or several following words even though only
 * one mouth is speaking at a time.
 *
 * Words whose own `start` is already past the next word's `start` are
 * left untouched — that is an ordering bug, not an overlap, and silently
 * rewriting it would hide it.
 */
export class WordOverlapClamper {
  clamp(words: ReadonlyArray<Word>): Word[] {
    return words.map((word, i) => {
      const next = words[i + 1];
      if (!next) return word;
      if (word.time.end <= next.time.start) return word;
      if (word.time.start >= next.time.start) return word;
      return word.with({ time: new TimeFragment(word.time.start, next.time.start) });
    });
  }
}
