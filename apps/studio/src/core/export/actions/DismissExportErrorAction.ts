import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Clears the error a finished export run left on the editor store,
 * which is what returns the export dialog to its settings phase.
 *
 * Kept apart from starting another run: the reader who wants a second
 * attempt usually wants to change something first, and the dialog they
 * come back to still holds the settings they had chosen.
 */
export class DismissExportErrorAction {
  constructor(private readonly editorStore: EditorStore) {}

  execute(): void {
    this.editorStore.patch({ error: null });
  }
}
