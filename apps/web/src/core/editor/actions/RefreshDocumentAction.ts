import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';

/**
 * Re-pipes every Section of the current Document according to its
 * `Section.kind` (which carries a Sheet id). Each section's segments are
 * merged and re-split per the sheet's current pipeline. No-op if
 * prerequisites aren't ready.
 */
export class RefreshDocumentAction {
  private _fontsRederivePending = false;

  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
  ) {}

  execute(): void {
    const { document, sheets, video, segmentOverrides } = this.store.snapshot();
    if (!document) return;
    if (sheets.length === 0) return;
    if (!video.layout) return;

    const next = this.deriver.derive(document, sheets, {
      videoWidth: video.layout.width,
      videoHeight: video.layout.height,
      videoDurationSeconds: video.duration,
      segmentOverrides,
    });
    this.store.patch({ document: next, status: 'ready' });

    // If fonts are still loading, the pixel-width splitter measured with the
    // fallback font. Re-derive once fonts are ready so line breaks reflect
    // actual font metrics.
    if (globalThis.document.fonts.status !== 'loaded' && !this._fontsRederivePending) {
      this._fontsRederivePending = true;
      globalThis.document.fonts.ready.then(() => {
        this._fontsRederivePending = false;
        this.execute();
      });
    }
  }
}
