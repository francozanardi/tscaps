import type { Sheet } from '@core/sheets/domain/Sheet';

export interface SheetStyleAssetUsage {
  readonly sheetId: string;
  readonly sheetName: string;
  readonly fieldLabel: string;
}

/**
 * Walks the open editor's sheets to find every image-typed style
 * control whose stored value points at a specific asset id. Used by
 * the asset library's delete confirmation so the user sees exactly
 * which sheets would lose their override.
 *
 * Only inspects the sheets currently in the editor state — usage in
 * the user's other projects requires a separate, heavier check that
 * this service does not perform.
 */
export class StyleAssetUsageInspector {
  findUsageOfAsset(assetId: string, sheets: ReadonlyArray<Sheet>): SheetStyleAssetUsage[] {
    return sheets.flatMap((sheet) => this.findUsageInSheet(assetId, sheet));
  }

  private findUsageInSheet(assetId: string, sheet: Sheet): SheetStyleAssetUsage[] {
    const matches: SheetStyleAssetUsage[] = [];
    for (const field of sheet.template.styleControls) {
      if (field.type !== 'image') continue;
      const raw = sheet.styleValues.values[field.id];
      if (typeof raw !== 'string' || raw !== assetId) continue;
      matches.push({ sheetId: sheet.id, sheetName: sheet.name, fieldLabel: field.label });
    }
    return matches;
  }
}
