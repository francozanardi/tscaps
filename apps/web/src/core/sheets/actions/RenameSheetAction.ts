import type { EditorStore } from '@core/editor/store/EditorStore';

export class RenameSheetAction {
  constructor(private readonly store: EditorStore) {}

  execute(sheetId: string, name: string): void {
    const { sheets } = this.store.snapshot();
    const target = sheets.find((s) => s.id === sheetId);
    if (!target) return;
    this.store.patch({ sheets: this.store.replaceSheet(target.with({ name })) });
  }
}
