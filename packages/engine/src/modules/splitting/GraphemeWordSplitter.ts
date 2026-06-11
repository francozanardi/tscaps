import type { WordSplitter } from '@modules/splitting/WordSplitter';

/**
 * Splits text into grapheme clusters — the units the user perceives as
 * single characters. Correctly handles surrogate pairs, combining marks,
 * ZWJ sequences, and regional-indicator flags, which `[...str]` shatters.
 */
export class GraphemeWordSplitter implements WordSplitter {
  private readonly segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

  split(text: string): string[] {
    return Array.from(this.segmenter.segment(text), (s) => s.segment);
  }
}
