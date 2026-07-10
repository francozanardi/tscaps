import type { EditorStore } from '@core/editor/store/EditorStore';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';

/**
 * Updates the line-splitter config on the active Sheet and triggers a
 * re-derivation. Sections belonging to other Sheets are unaffected.
 */
export class UpdateLineSplitterConfigAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  execute(patch: Partial<LineSplitterConfig>): void {
    const active = this.store.activeSheet();
    if (!active) return;
    const next = { ...active.lineSplitterConfig, ...patch } as LineSplitterConfig;
    const updated = active.with({ lineSplitterConfig: next });
    this.store.commit(`lineSplitter:${active.id}:${Object.keys(patch).join(',')}`);
    this.store.patch({ sheets: this.store.replaceSheet(updated) });
    this.refresh.execute();
  }
}
