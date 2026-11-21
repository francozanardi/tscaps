import type { Sheet } from '@core/sheets/domain/Sheet';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';

/**
 * Updates one entry in the active Sheet's segment-splitter pipeline,
 * identified by its `type`, and triggers a re-derivation. The pipeline
 * is the body's, or with `modeTag` the one of the template's mode whose
 * words carry that tag; a tag the template designs no mode for changes
 * nothing. The entry's
 * remaining fields are preserved; the `patch` is shallow-merged on top.
 * Sections belonging to other Sheets are unaffected. When the sheet
 * belongs to a link group, the same splitter config rides across to
 * every linked sibling.
 */
export class UpdateSegmentSplitterConfigAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly linkedSheetsSync: LinkedSheetsSync,
  ) {}

  execute(type: SegmentSplitterConfig['type'], patch: Partial<SegmentSplitterConfig>, modeTag: string | null = null): void {
    const active = this.store.activeSheet();
    if (!active) return;
    const updated = modeTag === null ? this.withBodyPatched(active, type, patch) : this.withModePatched(active, modeTag, type, patch);
    if (!updated) return;
    this.store.commit('Change caption layout', `segmentSplitter:${active.id}:${modeTag ?? 'body'}:${type}:${Object.keys(patch).join(',')}`);
    this.store.patch({ sheets: this.linkedSheetsSync.applyStyleEdit(updated, this.store.snapshot().sheets) });
    this.refresh.execute();
  }

  private withBodyPatched(sheet: Sheet, type: SegmentSplitterConfig['type'], patch: Partial<SegmentSplitterConfig>): Sheet {
    return sheet.with({ segmentSplitterConfigs: this.patched(sheet.segmentSplitterConfigs, type, patch) });
  }

  private withModePatched(sheet: Sheet, modeTag: string, type: SegmentSplitterConfig['type'], patch: Partial<SegmentSplitterConfig>): Sheet | null {
    const layout = sheet.modeLayout(modeTag);
    if (!layout) return null;
    return sheet.withModeLayout({ ...layout, segmentSplitterConfigs: this.patched(layout.segmentSplitterConfigs, type, patch) });
  }

  private patched(
    configs: ReadonlyArray<SegmentSplitterConfig>,
    type: SegmentSplitterConfig['type'],
    patch: Partial<SegmentSplitterConfig>,
  ): SegmentSplitterConfig[] {
    return configs.map((config) => (config.type === type ? ({ ...config, ...patch } as SegmentSplitterConfig) : config));
  }
}
