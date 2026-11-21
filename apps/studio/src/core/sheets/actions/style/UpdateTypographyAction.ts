import type { EditorStore } from '@core/editor/store/EditorStore';
import type { TypographyConfig } from '@core/sheets/domain/TypographyConfig';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';

const REDERIVE_DEBOUNCE_MS = 100;

/**
 * Updates typography on the Sheet named by the caller. Font size,
 * family, and letter spacing all affect pixel-width measurements used
 * by the line splitter, so document re-derivation is debounced to keep
 * slider drags smooth without leaving the layout stale. When the sheet
 * belongs to a link group, the same typography rides across to every
 * linked sibling. No-op when `sheetId` names no sheet in the current
 * state.
 */
export class UpdateTypographyAction {
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly linkedSheetsSync: LinkedSheetsSync,
  ) {}

  execute(sheetId: string, patch: Partial<TypographyConfig>): void {
    const target = this.store.sheet(sheetId);
    if (!target) return;
    const updated = target.with({ typographyConfig: { ...target.typographyConfig, ...patch } });
    this.store.commit('Change typography', `typography:${target.id}:${Object.keys(patch).join(',')}`);
    this.store.patch({ sheets: this.linkedSheetsSync.applyStyleEdit(updated, this.store.snapshot().sheets) });

    if (this._debounceTimer !== null) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this.refresh.execute();
    }, REDERIVE_DEBOUNCE_MS);
  }
}
