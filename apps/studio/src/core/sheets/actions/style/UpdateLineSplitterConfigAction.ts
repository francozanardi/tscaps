import type { Sheet } from '@core/sheets/domain/Sheet';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';

/**
 * Updates the line-splitter config on the active Sheet and triggers a
 * re-derivation: the body's, or with `modeTag` the one of the template's
 * mode whose words carry that tag (a tag the template designs no mode
 * for changes nothing). Sections belonging to other Sheets are unaffected.
 * When the sheet belongs to a link group, the same line-splitter config
 * rides across to every linked sibling.
 */
export class UpdateLineSplitterConfigAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly linkedSheetsSync: LinkedSheetsSync,
  ) {}

  execute(patch: Partial<LineSplitterConfig>, modeTag: string | null = null): void {
    const active = this.store.activeSheet();
    if (!active) return;
    const updated = modeTag === null ? this.withBodyPatched(active, patch) : this.withModePatched(active, modeTag, patch);
    if (!updated) return;
    this.store.commit('Change caption layout', `lineSplitter:${active.id}:${modeTag ?? 'body'}:${Object.keys(patch).join(',')}`);
    this.store.patch({ sheets: this.linkedSheetsSync.applyStyleEdit(updated, this.store.snapshot().sheets) });
    this.refresh.execute();
  }

  private withBodyPatched(sheet: Sheet, patch: Partial<LineSplitterConfig>): Sheet {
    return sheet.with({ lineSplitterConfig: { ...sheet.lineSplitterConfig, ...patch } as LineSplitterConfig });
  }

  private withModePatched(sheet: Sheet, modeTag: string, patch: Partial<LineSplitterConfig>): Sheet | null {
    const layout = sheet.modeLayout(modeTag);
    if (!layout) return null;
    return sheet.withModeLayout({ ...layout, lineSplitterConfig: { ...layout.lineSplitterConfig, ...patch } as LineSplitterConfig });
  }
}
