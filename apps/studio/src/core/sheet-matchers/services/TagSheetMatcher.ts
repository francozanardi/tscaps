import type { Word } from '@tscaps/engine';
import type { WordSheetMatcher } from '@core/sheet-matchers/domain/SheetMatcher';
import type { UserFacingTagName } from '@core/tagging/domain/TagName';

export interface TagSheetMatcherParams {
  /** Semantic tag name to match. */
  readonly tagName: UserFacingTagName;
}

/**
 * Matches the words carrying the given semantic tag. Word granularity
 * on purpose: taggers mark spans — one emphasis word, a quoted phrase —
 * so only the tagged words move to the target sheet while the rest of
 * each scene stays behind, mirroring how the auto-created sheets
 * partition at preprocessing time.
 */
export class TagSheetMatcher implements WordSheetMatcher<TagSheetMatcherParams> {
  readonly granularity = 'word' as const;

  matchesWord(word: Word, params: TagSheetMatcherParams): boolean {
    return word.hasTagName(params.tagName);
  }
}
