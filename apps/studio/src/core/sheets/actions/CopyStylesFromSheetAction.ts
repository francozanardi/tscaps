import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';

/**
 * Pulls every styling field from `sourceSheetId` into `targetSheetId`
 * in a single undoable step, leaving the target's identity intact (id,
 * name, color, structure-lock flag, and the segments assigned to it —
 * those live on the document, not on the sheet).
 *
 * Triggered per-target from the target sheet's popover, so the user
 * decides which other sheets receive the update. No link is kept
 * afterwards: later edits to the source don't ripple until the user
 * runs the action again on that target.
 */
export class CopyStylesFromSheetAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  execute(targetSheetId: string, sourceSheetId: string): void {
    if (targetSheetId === sourceSheetId) return;
    const { sheets } = this.store.snapshot();
    const source = sheets.find((s) => s.id === sourceSheetId);
    const target = sheets.find((s) => s.id === targetSheetId);
    if (!source || !target) return;

    const updated = target.with({
      template: source.template,
      styleValues: source.styleValues,
      typographyConfig: source.typographyConfig,
      segmentSplitterConfigs: source.segmentSplitterConfigs,
      lineSplitterConfig: source.lineSplitterConfig,
      alignmentConfig: source.alignmentConfig,
      effectConfigs: source.effectConfigs,
      cssOverride: source.cssOverride,
    });

    this.store.commit();
    this.store.patch({ sheets: this.store.replaceSheet(updated) });
    this.refresh.execute();
  }
}
