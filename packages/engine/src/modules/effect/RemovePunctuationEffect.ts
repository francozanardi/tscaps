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

  private static readonly TRAILING_PUNCTUATION = RemovePunctuationEffect.buildTrailingRegex();

  private static buildTrailingRegex(): RegExp {
    const alternatives = [...RemovePunctuationEffect.PUNCTUATION]
      .sort((a, b) => b.length - a.length)
      .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    return new RegExp(`(?:${alternatives})+$`, 'u');
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
            const stripped = word.text.replace(RemovePunctuationEffect.TRAILING_PUNCTUATION, '');
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
