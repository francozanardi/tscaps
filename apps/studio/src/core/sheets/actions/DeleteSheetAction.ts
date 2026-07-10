import { DocumentEditor } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';

const docEditor = new DocumentEditor();

/**
 * Deletes a Sheet (other than `main`). Every Section assigned to it
 * (i.e., `kind === sheetId`) is remapped to `main`; adjacent sections
 * that end up sharing a kind merge. If the deleted sheet was the active
 * one, `activeSheetId` resets to `main`.
 */
export class DeleteSheetAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  execute(sheetId: string): void {
    if (sheetId === MAIN_SHEET_ID) return;
    const { sheets, activeSheetId, document } = this.store.snapshot();
    if (!sheets.some((s) => s.id === sheetId)) return;

    const newSheets = sheets.filter((s) => s.id !== sheetId);
    const newActive = activeSheetId === sheetId ? MAIN_SHEET_ID : activeSheetId;
    const newDocument = document ? docEditor.remapKind(document, sheetId, MAIN_SHEET_ID) : document;

    this.store.commit();
    this.store.patch({
      sheets: newSheets,
      activeSheetId: newActive,
      document: newDocument,
    });
    this.refresh.execute();
  }
}
