import type { Effect } from '@modules/effect/Effect';
import type { Document } from '@modules/document/Document';
import type { Segment } from '@modules/document/Segment';

/**
 * Strips trailing punctuation from each matching word's `displayText`,
 * leaving the original `text` (the transcription source of truth)
 * untouched. Only punctuation at the end of the word is removed, so
 * tokens like `google.com` or `15:30` keep their inner symbols. The
 * deriver re-runs splitters and taggers from `text`, so toggling this
 * effect off naturally restores the punctuated rendering on the next
 * derivation.
 *
 * Trailing quotes (`"`, `“`, `”`, `'`, `‘`, `’`) are preserved and
 * stripping reaches past them: `end."` becomes `end"`, and `said
 * "hello".` becomes `said "hello"`. Apostrophes in contractions
 * (`I'm`, `rockin'`) are left intact since they aren't trailing
 * punctuation.
 */
export class RemovePunctuationEffect implements Effect {
  private static readonly PUNCTUATION: readonly string[] = [
    '...',
    '.',
    ',',
    ';',
    ':',
    '…',
  ];

  private static readonly TRAILING_QUOTES: readonly string[] = [
    '"',
    '“',
    '”',
    '\'',
    '‘',
    '’',
  ];

  private static readonly PUNCTUATION_BEFORE_TRAILING_QUOTES = RemovePunctuationEffect.buildRegex();

  private static buildRegex(): RegExp {
    const puncts = [...RemovePunctuationEffect.PUNCTUATION]
      .sort((a, b) => b.length - a.length)
      .map((p) => RemovePunctuationEffect.escapeForRegex(p))
      .join('|');
    const quotes = RemovePunctuationEffect.TRAILING_QUOTES
      .map((q) => RemovePunctuationEffect.escapeForRegex(q))
      .join('|');
    return new RegExp(`(?:${puncts})+(?=(?:${quotes})*$)`, 'u');
  }

  private static escapeForRegex(literal: string): string {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  constructor(
    private readonly segmentFilter: (segment: Segment) => boolean = () => true,
  ) {}

  apply(document: Document): Document {
    const newSections = document.sections.map((section) => {
      const newSegments = section.segments.map((segment) => {
        if (!this.segmentFilter(segment)) return segment;
        const newLines = segment.lines.map((line) => {
          const newWords = line.words.map((word) => {
            const stripped = word.text.replace(RemovePunctuationEffect.PUNCTUATION_BEFORE_TRAILING_QUOTES, '');
            if (stripped === word.displayText) return word;
            return word.with({ displayText: stripped });
          });
          return line.with({ words: newWords });
        });
        return segment.with({ lines: newLines });
      });
      return section.with({ segments: newSegments });
    });
    return document.with({ sections: newSections });
  }
}
