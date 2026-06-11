import type { Effect } from '@modules/effect/Effect';
import type { Document } from '@modules/document/Document';
import type { Segment } from '@modules/document/Segment';

/**
 * Replaces ASCII punctuation with typographic equivalents in each
 * matching word's `displayText`. Reads `displayText` (not `text`) so
 * the substitution composes with other display-text effects in the
 * pipeline order.
 *
 * Substitutions per word:
 *   - `"` followed by a letter or digit → `“`; otherwise → `”`
 *   - `'` always → `’` (typographic apostrophe)
 *   - `--` → `—` (em dash)
 *   - `...` → `…` (ellipsis)
 */
export class SmartPunctuationEffect implements Effect {

  constructor(
    private readonly segmentFilter: (segment: Segment) => boolean = () => true,
  ) {}

  apply(document: Document): Document {
    const newSections = document.sections.map((section) => {
      const newSegments = section.segments.map((segment) => {
        if (!this.segmentFilter(segment)) return segment;
        const newLines = segment.lines.map((line) => {
          const newWords = line.words.map((word) => {
            const styled = this.smartify(word.displayText);
            if (styled === word.displayText) return word;
            return word.with({ displayText: styled });
          });
          return line.with({ words: newWords });
        });
        return segment.with({ lines: newLines });
      });
      return section.with({ segments: newSegments });
    });
    return document.with({ sections: newSections });
  }

  private smartify(text: string): string {
    const expanded = this.replaceMultiCharGlyphs(text);
    return this.replaceQuotes(expanded);
  }

  private replaceMultiCharGlyphs(text: string): string {
    return text
      .replace(/\.{3}/g, '…')
      .replace(/--/g, '—');
  }

  private replaceQuotes(text: string): string {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        result += this.opensAQuotation(text, i) ? '“' : '”';
      } else if (ch === "'") {
        result += '’';
      } else {
        result += ch;
      }
    }
    return result;
  }

  private opensAQuotation(text: string, index: number): boolean {
    const next = text[index + 1] ?? '';
    return /[\p{L}\p{N}]/u.test(next);
  }
}
