import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SheetColorPalette } from '@core/sheets/services/SheetColorPalette';
import { MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';

/**
 * Creates a new Sheet by cloning the `main` sheet and assigning it a fresh
 * id, the given name, and a color from the palette. The new sheet is
 * appended to `sheets[]` and becomes the active one.
 */
export class CreateSheetAction {
  constructor(
    private readonly store: EditorStore,
    private readonly palette: SheetColorPalette,
  ) {}

  execute(name: string): string | null {
    const { sheets } = this.store.snapshot();
    const main = sheets.find((s) => s.id === MAIN_SHEET_ID);
    if (!main) return null;

    const id = crypto.randomUUID();
    const color = this.palette.pickColor(sheets.map((s) => s.color));
    const sheet = main.with({ id, name, color });

    this.store.commit();
    this.store.patch({ sheets: [...sheets, sheet], activeSheetId: id });
    return id;
  }
}
