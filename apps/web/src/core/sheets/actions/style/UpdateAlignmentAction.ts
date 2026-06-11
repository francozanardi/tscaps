import type { AlignmentConfig } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Updates alignment on the active Sheet. Purely visual — no document
 * re-derivation is triggered. When the user changes template within the
 * sheet, alignment resets to the new template's default (no overrides).
 */
export class UpdateAlignmentAction {
  constructor(private readonly store: EditorStore) {}

  execute(patch: Partial<AlignmentConfig>): void {
    const active = this.store.activeSheet();
    if (!active) return;
    const updated = active.with({ alignmentConfig: { ...active.alignmentConfig, ...patch } });
    this.store.commit(`alignment:${active.id}:${Object.keys(patch).join(',')}`);
    this.store.patch({ sheets: this.store.replaceSheet(updated) });
  }
}
