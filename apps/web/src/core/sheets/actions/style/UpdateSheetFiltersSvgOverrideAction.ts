import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';

const REDERIVE_DEBOUNCE_MS = 100;

/**
 * Replaces the active Sheet's `filters.svg` source with a user-edited
 * copy. Passing `null` clears the override so the sheet renders with
 * the template's pristine filters again. Re-derivation is debounced
 * because the document deriver re-parses the SVG and re-materializes
 * the filter defs on every active segment.
 */
export class UpdateSheetFiltersSvgOverrideAction {
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  execute(filtersSvgOverride: string | null): void {
    const active = this.store.activeSheet();
    if (!active) return;
    const updated = active.with({ filtersSvgOverride });
    this.store.commit(`filtersSvgOverride:${active.id}`);
    this.store.patch({ sheets: this.store.replaceSheet(updated) });

    if (this._debounceTimer !== null) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this.refresh.execute();
    }, REDERIVE_DEBOUNCE_MS);
  }
}
