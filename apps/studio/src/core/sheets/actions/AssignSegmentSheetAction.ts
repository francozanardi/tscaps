import { Document, DocumentEditor, type Section, type Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver, DocumentDeriverContext } from '@core/editor/services/DocumentDeriver';

const docEditor = new DocumentEditor();

/**
 * Reassigns a derived Segment to a different Sheet. The moved segment is
 * piped under the target sheet's rules and lifted into a Section with the
 * new kind; if it lands adjacent to existing same-kind segments, those
 * are reflowed together so the splitter sees the merged input.
 */
export class AssignSegmentSheetAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
  ) {}

  execute(derivedSegment: Segment, sheetId: string): void {
    const { sheets, document, video, segmentOverrides, decorationOverrides } = this.store.snapshot();
    if (!document) return;
    if (!video.layout) return;

    const targetSheet = sheets.find((s) => s.id === sheetId);
    if (!targetSheet) return;
    if (this._sectionKindOf(document, derivedSegment.id) === sheetId) return;

    const ctx: DocumentDeriverContext = {
      videoWidth: video.layout.width,
      videoHeight: video.layout.height,
      videoDurationSeconds: video.duration,
      segmentOverrides,
      decorationOverrides,
    };
    const piped = this.deriver.runSheetPipeline([derivedSegment], targetSheet, ctx);
    if (piped.length === 0) return;

    const replaced = docEditor.replaceSegmentWithKind(document, derivedSegment.id, piped, sheetId);
    const reflowed = this._reflowTargetSection(replaced, piped, targetSheet, ctx);

    this.store.commit();
    this.store.patch({ document: this.deriver.retag(reflowed) });
  }

  /**
   * Re-pipes the section that now owns the moved segment so adjacent
   * same-kind neighbours flow as one input. Segments the user has
   * already styled are frozen — they stay verbatim and their overrides
   * survive the reflow.
   */
  private _reflowTargetSection(
    doc: Document,
    moved: ReadonlyArray<Segment>,
    targetSheet: Sheet,
    ctx: DocumentDeriverContext,
  ): Document {
    const movedIds = new Set(moved.map((s) => s.id));
    const sectionIdx = doc.sections.findIndex((sec) => sec.segments.some((s) => movedIds.has(s.id)));
    if (sectionIdx < 0) return doc;

    const section = doc.sections[sectionIdx]!;
    const piped = this.deriver.reflowSection(section.segments, targetSheet, ctx);
    if (piped.length === 0) return doc;

    const next: Section[] = [...doc.sections];
    next[sectionIdx] = section.with({ segments: piped });
    return new Document({ sections: next });
  }

  private _sectionKindOf(document: Document, segmentId: string): string | null {
    for (const section of document.sections) {
      for (const segment of section.segments) {
        if (segment.id === segmentId) return section.kind;
      }
    }
    return null;
  }
}
