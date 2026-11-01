/** One word of the caption a template's gallery tile shows. */
export interface TemplateTileWord {
  readonly text: string;
  /** Semantic tags the word carries, by name (`emphasis`, `entity`, …), so the tile shows what the template does with them. */
  readonly tags: readonly string[];
  /** The emoji the word carries, or `null`. */
  readonly emoji: string | null;
  /** Whether the tile is frozen while this word is being said. */
  readonly said: boolean;
}

/**
 * The caption a template's gallery tile shows in place of the
 * template's name, for a template whose look one word cannot carry:
 * two lines that differ, a word lit by a tag, an emoji. Its lines and
 * words, in reading order. The tile rests on the word marked `said`, or
 * once every word has been said when none is.
 */
export interface TemplateTile {
  readonly lines: ReadonlyArray<ReadonlyArray<TemplateTileWord>>;
}
