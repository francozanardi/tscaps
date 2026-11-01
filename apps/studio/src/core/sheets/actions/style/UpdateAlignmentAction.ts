import type { AlignmentConfig } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';

/**
 * Updates alignment on the Sheet named by the caller. Purely visual — no
 * document re-derivation is triggered. When the user changes template
 * within the sheet, alignment resets to the new template's default (no
 * overrides). When the sheet belongs to a link group, the same alignment
 * rides across to every linked sibling. No-op when `sheetId` names no
 * sheet in the current state, and when the patch moves a vertical anchor
 * the sheet's template holds: that template's layout is built from the
 * edge it holds, and the rest of the patch was stated against the anchor
 * it cannot take.
 */
export class UpdateAlignmentAction {
  constructor(
    private readonly store: EditorStore,
    private readonly linkedSheetsSync: LinkedSheetsSync,
  ) {}

  execute(sheetId: string, patch: Partial<AlignmentConfig>): void {
    const target = this.store.sheet(sheetId);
    if (!target) return;
    if (this.movesHeldAnchor(target, patch)) return;
    const updated = target.with({ alignmentConfig: { ...target.alignmentConfig, ...patch } });
    this.store.commit(`alignment:${target.id}:${Object.keys(patch).join(',')}`);
    this.store.patch({ sheets: this.linkedSheetsSync.applyStyleEdit(updated, this.store.snapshot().sheets) });
  }

  private movesHeldAnchor(sheet: Sheet, patch: Partial<AlignmentConfig>): boolean {
    const held = sheet.template.heldVerticalAlign();
    return held !== null && patch.verticalAlign !== undefined && patch.verticalAlign !== held;
  }
}
