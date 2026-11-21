import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SetActiveSheetAction } from '@core/sheets/actions/SetActiveSheetAction';

/**
 * Runs an edit that acts on the active sheet against any sheet: the
 * sheet is made active for the edit, and the one active before it is
 * made active again after, so the person stays on the sheet they were
 * looking at. Switching is not an undo step of its own; which sheet is
 * active is part of what an undo restores, though, so undoing an edit
 * made this way can land on the sheet it was made on.
 */
export class ActiveSheetEditRunner {
  constructor(
    private readonly store: EditorStore,
    private readonly setActiveSheet: SetActiveSheetAction,
  ) {}

  /**
   * Runs `edit` while `sheetId` is the active sheet and returns what it
   * returns. The sheet active before is put back even when `edit` throws.
   * `sheetId` must name a sheet of the project.
   */
  runOn<T>(sheetId: string, edit: () => T): T {
    const previous = this.store.snapshot().activeSheetId;
    if (previous === sheetId) return edit();
    this.setActiveSheet.execute(sheetId);
    try {
      return edit();
    } finally {
      if (previous !== null) this.setActiveSheet.execute(previous);
    }
  }
}
