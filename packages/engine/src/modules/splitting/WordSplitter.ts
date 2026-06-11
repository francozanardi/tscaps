/**
 * Splits a word's text into the visual units a renderer should paint as
 * separate elements (typically per-letter spans).
 */
export interface WordSplitter {
  split(text: string): string[];
}
