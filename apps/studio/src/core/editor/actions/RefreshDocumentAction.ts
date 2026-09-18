import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import type { SheetScriptsSynchronizer } from '@core/sheets/services/SheetScriptsSynchronizer';

/**
 * Re-pipes every Section of the current Document according to its
 * `Section.kind` (which carries a Sheet id). Each section's segments are
 * merged and re-split per the sheet's current pipeline. No-op if
 * prerequisites aren't ready.
 *
 * Each sheet's writing systems are re-synced from the document first,
 * because the pipeline measures lines with the family that sheet's font
 * stack compiles to, and which faces that family carries follows them.
 */
export class RefreshDocumentAction {
  private awaitedFontLoad: Promise<FontFaceSet> | null = null;

  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
    private readonly scriptsSynchronizer: SheetScriptsSynchronizer,
  ) {}

  execute(): void {
    const { document, sheets, video, frozenSegments, decorationOverrides } = this.store.snapshot();
    if (!document) return;
    if (sheets.length === 0) return;
    if (!video.layout) return;

    const syncedSheets = this.scriptsSynchronizer.sync(document, sheets);
    const next = this.deriver.derive(document, syncedSheets, {
      videoWidth: video.layout.width,
      videoHeight: video.layout.height,
      videoDurationSeconds: video.duration,
      frozenSegments,
      decorationOverrides,
    });
    this.store.patch({
      document: next,
      status: 'ready',
      ...(syncedSheets !== sheets ? { sheets: [...syncedSheets] } : {}),
    });

    this.rederiveWhenFontsArrive();
  }

  /**
   * Derives again once a face that was still loading arrives, so its
   * lines are measured with the face and not with its stand-in.
   *
   * Waits on each promise at most once. `status` can stay on `loading`
   * over a set that has already settled, and the promise it then hands
   * back is the settled one — awaiting it again re-derives the whole
   * document every microtask. A load that begins hands back a new one.
   */
  private rederiveWhenFontsArrive(): void {
    if (globalThis.document.fonts.status === 'loaded') return;
    const arrival = globalThis.document.fonts.ready;
    if (arrival === this.awaitedFontLoad) return;
    this.awaitedFontLoad = arrival;
    void arrival.then(() => this.execute());
  }
}
