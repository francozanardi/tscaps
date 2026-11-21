import { useMemo } from 'react';
import type { Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { TAG_METADATA, WORD_TAG_NAMES, type TagScope, type UserFacingTagName } from '@core/tagging/domain/TagName';
import { useTagging } from '@ui/_shared/contexts/modules/TaggingContext';

export interface WordTagRow {
  readonly name: UserFacingTagName;
  readonly scope: TagScope;
  /** What the row is called: the tag's label, or the name of the template's mode it routes words to. */
  readonly label: string;
  /** What the (?) explains: the tag's description, or the mode's legend. */
  readonly description: string;
  /** `mixed` when only part of the words carry the tag. */
  readonly checked: boolean | 'mixed';
}

/**
 * The tag rows to offer over `words`: the transcript tags this sheet
 * paints, and only those, so every row in the list is one the caption
 * reacts to; then a row for each mode the sheet's template designs, named
 * after the mode, since its tag is what puts a word in it.
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
      const meta = TAG_METADATA[name];
      if (meta.scope !== 'transcript' || !styled.has(name)) continue;
      rows.push({ name, scope: 'transcript', label: meta.label, description: meta.description, checked: checkedOn(words, name) });
    }
    for (const mode of sheet.template.modes.extra) {
      const description = mode.legend ?? TAG_METADATA[mode.tag].description;
      rows.push({ name: mode.tag, scope: 'template', label: mode.label, description, checked: checkedOn(words, mode.tag) });
    }
    return rows;
  }, [styledTagNameResolver, words, sheet]);
}

function checkedOn(words: ReadonlyArray<Word>, name: UserFacingTagName): boolean | 'mixed' {
  const carrying = words.filter((word) => word.hasTagName(name)).length;
  if (carrying === words.length) return true;
  return carrying > 0 ? 'mixed' : false;
}
