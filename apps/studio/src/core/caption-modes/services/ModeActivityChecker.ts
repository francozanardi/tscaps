import type { EditorStore } from '@core/editor/store/EditorStore';
import type { Template } from '@core/templates/domain/Template';
import type { ModeMatcherRegistry } from '@core/caption-modes/services/ModeMatcherRegistry';

/**
 * Whether a template's modes would take any word of the open document,
 * read off the document at call time: a template whose look lives in a
 * mode offers only its plainest captions where no word would enter it.
 * The matchers are the template's own, run over every word, so the
 * answer does not depend on which template the sheets use now.
 */
export class ModeActivityChecker {
  constructor(
    private readonly matchers: ModeMatcherRegistry,
    private readonly editorStore: EditorStore,
  ) {}

  /** True for a template that designs no mode; false for one with modes while no document is open. */
  isActive(template: Template): boolean {
    if (template.modes.extra.length === 0) return true;
    const words = this.editorStore.snapshot().document?.getWords() ?? [];
    if (words.length === 0) return false;
    return template.modes.extra.some((mode) =>
      mode.matchers.some((config) => this.matchers.build(config).matchingWordIds(words).size > 0));
  }
}
