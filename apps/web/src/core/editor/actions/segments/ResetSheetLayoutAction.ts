import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';

/**
 * Wipes every per-segment freeze and style override for the segments
 * belonging to the given sheet, then re-derives so the splitter
 * pipeline reflows the sheet's sections from scratch.
 */
export class ResetSheetLayoutAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  execute(sheetId: string): void {
    const snap = this.store.snapshot();
    const document = snap.document;
    if (!document) return;

    const sheetSegmentIds: string[] = [];
    for (const section of document.sections) {
      if (section.kind !== sheetId) continue;
      for (const seg of section.segments) sheetSegmentIds.push(seg.id);
    }

    const next = snap.segmentOverrides.resetSegments(sheetSegmentIds);
    if (next === snap.segmentOverrides) return;

    this.store.commit();
    this.store.patch({ segmentOverrides: next });
    this.refresh.execute();
  }
}
