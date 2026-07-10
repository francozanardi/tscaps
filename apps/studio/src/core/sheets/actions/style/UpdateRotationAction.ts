import type { RotationConfig } from '@core/sheets/domain/RotationConfig';
import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Updates rotation on the active Sheet. Purely visual — rotation is a
 * post-positioning transform that never feeds into the line splitter's
 * pixel measurements, so no document re-derivation is triggered.
 */
export class UpdateRotationAction {
  constructor(private readonly store: EditorStore) {}

  execute(patch: Partial<RotationConfig>): void {
    const active = this.store.activeSheet();
    if (!active) return;
    const updated = active.with({ rotationConfig: { ...active.rotationConfig, ...patch } });
    this.store.commit(`rotation:${active.id}:${Object.keys(patch).join(',')}`);
    this.store.patch({ sheets: this.store.replaceSheet(updated) });
  }
}
