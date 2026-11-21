import type { Document } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { OperationProblem } from '@core/editor-operations/domain/OperationResult';

/**
 * Tells whether a word's caption style gives a tag a look of its own. A
 * tag only marks a word; what it looks like is the stylesheet's to say, and
 * many templates style a few tags or none, so a word tagged under one of
 * them looks like every other word.
 */
export class WordTagLookChecker {
  constructor(private readonly store: EditorStore) {}

  /** One warning per tag of `tags` the stylesheet of the word `wordId` never selects; `ref` names the word. */
  warningsFor(wordId: string, ref: string, tags: ReadonlyArray<string>): OperationProblem[] {
    const css = this.cssOfWord(wordId);
    if (css === null) return [];
    return tags
      .filter((tag) => !new RegExp(`\\.${this.escaped(tag)}(?![\\w-])`).test(css))
      .map((tag) => ({
        severity: 'warning' as const,
        ref,
        message: `This caption style gives the tag "${tag}" no look of its own, so ${ref} looks like the words around it. Give it one with set_element_css, or pick a template that styles it.`,
      }));
  }

  private cssOfWord(wordId: string): string | null {
    const state = this.store.snapshot();
    const sheetId = this.sheetIdOfWord(state.document, wordId);
    const sheet = sheetId === null ? null : this.store.sheet(sheetId);
    return sheet === null ? null : sheet.resolveCss();
  }

  private sheetIdOfWord(document: Document | null, wordId: string): string | null {
    if (document === null) return null;
    const section = document.sections.find((each) => each.getWords().some((word) => word.id === wordId));
    return section?.kind ?? null;
  }

  private escaped(tag: string): string {
    return tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
