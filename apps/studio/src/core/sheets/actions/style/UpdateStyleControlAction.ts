import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';

const REDERIVE_DEBOUNCE_MS = 100;

/**
 * Updates a single style control value on the active Sheet. CSS vars are
 * derived from the sheet downstream, so the overlay reflects the change
 * immediately. Document re-derivation is debounced so line measurements stay
 * accurate without lagging on every slider tick.
 */
export class UpdateStyleControlAction {
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  execute(field: ControlField, value: ControlValue): void {
    const active = this.store.activeSheet();
    if (!active) return;
    const updated = active.with({ styleValues: active.styleValues.withValue(field, value) });
    this.store.commit(`style:${active.id}:${field.id}`);
    this.store.patch({ sheets: this.store.replaceSheet(updated) });

    if (this._debounceTimer !== null) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this.refresh.execute();
    }, REDERIVE_DEBOUNCE_MS);
  }
}
