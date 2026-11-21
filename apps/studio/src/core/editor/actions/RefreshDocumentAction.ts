import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import type { SheetScriptsSynchronizer } from '@core/sheets/services/SheetScriptsSynchronizer';

/**
 * Re-pipes every Section of the current Document according to its
 * `Section.kind` (which carries a Sheet id). Each section's segments are
 * merged and re-split per the sheet's current pipeline. No-op if
 * prerequisites aren't ready. Works on the editor's store, or on the
 * store it is handed, such as the store of a session the editor has
 * left.
 *
 * Each sheet's writing systems are re-synced from the document first,
 * because the pipeline measures lines with the family that sheet's font
 * stack compiles to, and which faces that family carries follows them.
 */
export class RefreshDocumentAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
    private readonly scriptsSynchronizer: SheetScriptsSynchronizer,
  ) {}

  execute(store: EditorStore = this.store): void {
    const { document, sheets, video, frameLayout, frozenSegments, decorationOverrides } = store.snapshot();
    if (!document) return;
    if (sheets.length === 0) return;
    if (!frameLayout) return;

    const syncedSheets = this.scriptsSynchronizer.sync(document, sheets);
    const next = this.deriver.derive(document, syncedSheets, {
      videoWidth: frameLayout.width,
      videoHeight: frameLayout.height,
      videoDurationSeconds: video.duration,
      frozenSegments,
      decorationOverrides,
    });
    store.patch({
      document: next,
      status: 'ready',
      ...(syncedSheets !== sheets ? { sheets: [...syncedSheets] } : {}),
    });
  }
}
