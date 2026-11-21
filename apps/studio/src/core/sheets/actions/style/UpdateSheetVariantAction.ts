import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';

/**
 * Switches the active sheet to a different style variant. Re-seeds
 * `styleValues` from the new variant's overrides, dropping any
 * manual per-field edits the user had applied to the previous one —
 * variant switching follows the "preset replaces local edits" rule
 * the same way template switching does. Pushes a single undo entry
 * and triggers a document re-derivation because variant overrides
 * commonly touch font size and other layout-affecting controls.
 *
 * No-ops when no sheet is active, when the picked variant is the one the
 * sheet already reads, or when the template ships fewer than two
 * variants. Picking the variant already showing therefore leaves the
 * sheet's stored preference alone, even when that preference names a
 * slot this template does not have; picking a different one replaces it,
 * because an explicit choice outranks an inherited one.
 */
export class UpdateSheetVariantAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  execute(variantIndex: number): void {
    const active = this.store.activeSheet();
    if (!active) return;
    if (active.template.variants.length < 2) return;
    if (active.resolveVariantIndex() === variantIndex) return;
    const updated = active.withVariant(variantIndex);
    this.store.commit('Change preset', `variant:${active.id}`);
    this.store.patch({ sheets: this.store.replaceSheet(updated) });
    this.refresh.execute();
  }
}
