import type { Word } from '@tscaps/engine';

/** Picks the words of one sheet's captions that belong in a mode. */
export interface ModeMatcher {
  /** The ids of the words of `words`, given in reading order, that this matcher puts in the mode. */
  matchingWordIds(words: ReadonlyArray<Word>): ReadonlySet<string>;
}
