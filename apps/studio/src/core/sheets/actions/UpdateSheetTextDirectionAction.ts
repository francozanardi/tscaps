import type { TextDirection } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Sets the paragraph direction the active Sheet's captions are laid out
 * against.
 *
 * It states the language of the text rather than a look, so it does not
 * ride across to style-linked sibling sheets: a video with one sheet per
 * speaker can legitimately mix a right-to-left speaker with a
 * left-to-right one. Word widths do not change with direction, so the
 * document needs no re-derivation either.
 */
export class UpdateSheetTextDirectionAction {

  constructor(private readonly store: EditorStore) {}

  execute(textDirection: TextDirection): void {
    const active = this.store.activeSheet();
    if (!active || active.textDirection === textDirection) return;
    this.store.commit('Change text direction', `text-direction:${active.id}`);
    const sheets = this.store.snapshot().sheets.map(
      (sheet) => sheet.id === active.id ? sheet.with({ textDirection }) : sheet,
    );
    this.store.patch({ sheets });
  }
}
