import type { Document, Word } from '@tscaps/engine';
import type { WordSheetMatcher } from '@core/sheet-matchers/domain/SheetMatcher';

export interface SpeakerSheetMatcherParams {
  /** Speaker id to match. */
  readonly speakerId: string;
}

/**
 * Matches the words one speaker says. Word granularity, like the tag
 * matcher: a scene two voices share is carved between them rather than
 * refused, and each side is re-split under its own sheet's rules
 * afterwards. Nothing has to be tidy before this runs.
 */
export class SpeakerSheetMatcher implements WordSheetMatcher<SpeakerSheetMatcherParams> {
  readonly granularity = 'word' as const;

  matchesWord(word: Word, params: SpeakerSheetMatcherParams): boolean {
    return word.speakerId === params.speakerId;
  }

  /**
   * Distinct speaker ids carried by the document's words, in order of
   * first appearance. `null` (words without speaker attribution) is
   * preserved as an explicit entry; callers that only care about
   * attributed voices filter it out themselves.
   */
  collectSpeakerIds(document: Document): (string | null)[] {
    const seen = new Set<string | null>();
    const ordered: (string | null)[] = [];
    for (const segment of document.getSegments()) {
      for (const word of segment.getWords()) {
        if (seen.has(word.speakerId)) continue;
        seen.add(word.speakerId);
        ordered.push(word.speakerId);
      }
    }
    return ordered;
  }
}
