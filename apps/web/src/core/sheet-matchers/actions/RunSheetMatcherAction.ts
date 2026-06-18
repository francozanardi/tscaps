import { Document, DocumentEditor, Section } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver, DocumentDeriverContext } from '@core/editor/services/DocumentDeriver';
import type { SheetMatcher } from '@core/sheet-matchers/domain/SheetMatcher';

const docEditor = new DocumentEditor();

/**
 * Bulk-assigns every segment that the matcher says yes to into the
 * target sheet, in a single undoable step. Segments that already belong
 * to the target are skipped. After the moves, each section that ended
 * up under the target kind is re-piped under the target sheet's rules
 * (unless the sheet is structure-locked) so adjacent moved segments
 * flow together as one input.
 *
 * Non-matching segments are never touched — including segments currently
 * assigned to the target sheet that no longer match. This is a positive
 * batch-assignment; it has no concept of "removing" ownership.
 */
export class RunSheetMatcherAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
  ) {}

  execute<TParams>(sheetId: string, matcher: SheetMatcher<TParams>, params: TParams): void {
    const { sheets, document, video, segmentOverrides, decorationOverrides } = this.store.snapshot();
    if (!document) return;
    if (!video.layout) return;

    const targetSheet = sheets.find((s) => s.id === sheetId);
    if (!targetSheet) return;

    const ctx: DocumentDeriverContext = {
      videoWidth: video.layout.width,
      videoHeight: video.layout.height,
      videoDurationSeconds: video.duration,
      segmentOverrides,
      decorationOverrides,
    };

    // Snapshot ids first; the doc mutates as we move segments.
    const movingIds: string[] = [];
    for (const seg of document.getSegments()) {
      if (seg.getSection().kind === sheetId) continue;
      if (!matcher.matches(seg, params)) continue;
      movingIds.push(seg.id);
    }
    if (movingIds.length === 0) return;

    this.store.commit();

    let doc = document;
    for (const segId of movingIds) {
      const seg = doc.getSegments().find((s) => s.id === segId);
      if (!seg) continue;
      const piped = this.deriver.runSheetPipeline([seg], targetSheet, ctx);
      if (piped.length === 0) continue;
      doc = docEditor.replaceSegmentWithKind(doc, segId, piped, sheetId);
    }

    doc = this._reflowTargetSections(doc, sheetId, targetSheet, ctx);
    this.store.patch({ document: this.deriver.retag(doc) });
  }

  /**
   * Re-pipes every section whose `kind` matches the target so the moved
   * segments flow with their new neighbours as a single splitter input.
   * Segments the user has already styled are frozen — they stay verbatim
   * and their overrides survive the reflow.
   */
  private _reflowTargetSections(
    doc: Document,
    targetKind: string,
    targetSheet: Sheet,
    ctx: DocumentDeriverContext,
  ): Document {
    const next: Section[] = doc.sections.map((sec) => {
      if (sec.kind !== targetKind) return sec;
      const piped = this.deriver.reflowSection(sec.segments, targetSheet, ctx);
      if (piped.length === 0) return sec;
      return sec.with({ segments: piped });
    });
    return new Document({ sections: next });
  }
}
