import { useMemo } from 'react';
import type { Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { WORD_TAG_NAMES, type UserFacingTagName } from '@core/tagging/domain/TagName';
import { useTagging } from '@ui/_shared/contexts/modules/TaggingContext';

export interface WordTagRow {
  readonly name: UserFacingTagName;
  /** `mixed` when only part of the words carry the tag. */
  readonly checked: boolean | 'mixed';
}

/**
 * The tag rows to offer over `words`: the ones this sheet paints, and
 * only those, so every row in the list is one the caption reacts to.
 *
 * Empty means there is nothing worth opening a tag editor for. A tag
 * a word carries from elsewhere is then out of reach until a sheet
 * that paints it is in play, which is also the only place taking it
 * off would show.
 */
export function useWordTagRows(
  words: ReadonlyArray<Word>,
  sheet: Sheet | null,
): ReadonlyArray<WordTagRow> {
  const { styledTagNameResolver } = useTagging();
  return useMemo(() => {
    if (words.length === 0 || !sheet) return [];
    const styled = styledTagNameResolver.resolve(sheet.resolveCss());
    const rows: WordTagRow[] = [];
    for (const name of WORD_TAG_NAMES) {
      if (!styled.has(name)) continue;
      const carrying = words.filter((word) => word.hasTagName(name)).length;
      let checked: boolean | 'mixed' = false;
      if (carrying === words.length) checked = true;
      else if (carrying > 0) checked = 'mixed';
      rows.push({ name, checked });
    }
    return rows;
  }, [styledTagNameResolver, words, sheet]);
}
