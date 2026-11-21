import type { RotationConfig } from '@core/sheets/domain/RotationConfig';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';

/**
 * Updates rotation on the Sheet named by the caller. Purely visual —
 * rotation is a post-positioning transform that never feeds into the
 * line splitter's pixel measurements, so no document re-derivation is
 * triggered. When the sheet belongs to a link group, the same rotation
 * rides across to every linked sibling. No-op when `sheetId` names no
 * sheet in the current state.
 */
export class UpdateRotationAction {
  constructor(
    private readonly store: EditorStore,
    private readonly linkedSheetsSync: LinkedSheetsSync,
  ) {}

  execute(sheetId: string, patch: Partial<RotationConfig>): void {
    const target = this.store.sheet(sheetId);
    if (!target) return;
    const updated = target.with({ rotationConfig: { ...target.rotationConfig, ...patch } });
    this.store.commit('Change rotation', `rotation:${target.id}:${Object.keys(patch).join(',')}`);
    this.store.patch({ sheets: this.linkedSheetsSync.applyStyleEdit(updated, this.store.snapshot().sheets) });
  }
}
