import type { EditorStore } from '@core/editor/store/EditorStore';
import type { TypographyConfig } from '@core/sheets/domain/TypographyConfig';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';

const REDERIVE_DEBOUNCE_MS = 100;

/**
 * Updates typography on the active Sheet. Font size, family, and letter
 * spacing all affect pixel-width measurements used by the line splitter,
 * so document re-derivation is debounced (same shape as
 * `UpdateStyleControlAction`) to keep slider drags smooth without leaving
 * the layout stale.
 */
export class UpdateTypographyAction {
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  execute(patch: Partial<TypographyConfig>): void {
    const active = this.store.activeSheet();
    if (!active) return;
    const updated = active.with({ typographyConfig: { ...active.typographyConfig, ...patch } });
    this.store.commit(`typography:${active.id}:${Object.keys(patch).join(',')}`);
    this.store.patch({ sheets: this.store.replaceSheet(updated) });

    if (this._debounceTimer !== null) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this.refresh.execute();
    }, REDERIVE_DEBOUNCE_MS);
  }
}
