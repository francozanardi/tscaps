import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import type { SheetElementResolver } from '@core/sheets/domain/SheetElementResolver';

/**
 * Puts a sheet back to the state a fresh pick of its current template
 * would leave it in — every sheet-level slice reseeded from the
 * template (typography, style values, splitters, alignment, rotation,
 * effects, motion, CSS and SVG-filter overrides) and every per-element
 * style + behind-actor override recorded under any of its segments,
 * lines, words or decorations cleared. `variantIndex` is preserved:
 * the preset the sheet stands for is not a manual edit and a reset
 * does not swap it.
 *
 * One undoable step. A linked group re-seeds together, the same way it
 * does on a template swap.
 */
export class ResetSheetToTemplateDefaultsAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly linkedSheetsSync: LinkedSheetsSync,
    private readonly sheetElementResolver: SheetElementResolver,
  ) {}

  execute(sheetId: string): void {
    const snap = this.store.snapshot();
    const sheet = snap.sheets.find((candidate) => candidate.id === sheetId);
    if (!sheet) return;

    const reset = sheet.withTemplate(sheet.template);
    const elementIds = this.sheetElementResolver.elementsOf(sheet.id);

    this.store.commit('Reset sheet to template');
    this.store.patch({
      sheets: this.linkedSheetsSync.applyTemplateEdit(reset, this.store.snapshot().sheets),
      elementStyles: snap.elementStyles.without(elementIds),
      behindActorOverrides: snap.behindActorOverrides.without(elementIds),
    });
    this.refresh.execute();
  }
}
