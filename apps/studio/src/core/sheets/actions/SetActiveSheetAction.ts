import type { EditorStore } from '@core/editor/store/EditorStore';

export class SetActiveSheetAction {
  constructor(private readonly store: EditorStore) {}

  execute(sheetId: string): void {
    const { sheets } = this.store.snapshot();
    if (!sheets.some((s) => s.id === sheetId)) return;
    this.store.patch({ activeSheetId: sheetId });
  }
}
