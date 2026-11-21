import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';

/**
 * Wipes the own style and the hand-drawn boundaries of every segment
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

    const elementStyles = snap.elementStyles.without(sheetSegmentIds);
    const frozenSegments = snap.frozenSegments.withoutStructurallyEdited(sheetSegmentIds);
    if (elementStyles === snap.elementStyles && frozenSegments === snap.frozenSegments) return;

    this.store.commit('Reset manual layout');
    this.store.patch({ elementStyles, frozenSegments });
    this.refresh.execute();
  }
}
