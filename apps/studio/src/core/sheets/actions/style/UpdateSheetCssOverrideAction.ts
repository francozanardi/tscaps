import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';

const REDERIVE_DEBOUNCE_MS = 100;

/**
 * Replaces the active Sheet's CSS with a user-edited copy. Passing `null`
 * clears the override so the sheet renders with the template's pristine
 * CSS again. Re-derivation is debounced because rules touching font
 * weight, padding, or letter spacing change the pixel widths the line
 * splitter measures against.
 */
export class UpdateSheetCssOverrideAction {
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  execute(cssOverride: string | null): void {
    const active = this.store.activeSheet();
    if (!active) return;
    const updated = active.with({ cssOverride });
    this.store.commit(`cssOverride:${active.id}`);
    this.store.patch({ sheets: this.store.replaceSheet(updated) });

    if (this._debounceTimer !== null) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this.refresh.execute();
    }, REDERIVE_DEBOUNCE_MS);
  }
}
