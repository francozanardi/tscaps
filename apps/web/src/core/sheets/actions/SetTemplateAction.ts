import type { Document } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { Template } from '@core/templates/domain/Template';
import type { RecordTemplateUseAction } from '@core/templates/actions/RecordTemplateUseAction';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';

interface SheetContentIds {
  readonly segmentIds: string[];
  readonly wordIds: string[];
}

/**
 * Applies a Template to the currently active Sheet — resetting style
 * values, splitter configs, alignment, and effects — and records the
 * pick as recently used.
 */
export class SetTemplateAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly recordTemplateUse: RecordTemplateUseAction,
    private readonly telemetry: Telemetry,
  ) {}

  execute(template: Template): void {
    const snap = this.store.snapshot();
    const activeSheet = this.store.activeSheet();
    if (!activeSheet) return;
    const fromTemplateId = activeSheet.template.metadata.id;
    const updated = activeSheet.withTemplate(template);

    const contentIds = this.collectSheetContentIds(snap.document, activeSheet.id);
    const nextSegmentOverrides = snap.segmentOverrides.resetSegments(contentIds.segmentIds);
    const nextWordOverrides = snap.wordStyleOverrides.resetWords(contentIds.wordIds);

    this.store.commit();
    this.store.patch({
      sheets: this.store.replaceSheet(updated),
      segmentOverrides: nextSegmentOverrides,
      wordStyleOverrides: nextWordOverrides,
    });
    this.refresh.execute();
    this.recordTemplateUse.execute(template.metadata.id);
    this.captureTemplateSelected(template, fromTemplateId);
  }

  private collectSheetContentIds(document: Document | null, sheetId: string): SheetContentIds {
    const segmentIds: string[] = [];
    const wordIds: string[] = [];
    if (!document) return { segmentIds, wordIds };
    for (const section of document.sections) {
      if (section.kind !== sheetId) continue;
      for (const seg of section.segments) {
        segmentIds.push(seg.id);
        for (const line of seg.lines) {
          for (const word of line.words) wordIds.push(word.id);
        }
      }
    }
    return { segmentIds, wordIds };
  }

  private captureTemplateSelected(template: Template, fromTemplateId: string): void {
    const sameTemplate = template.metadata.id === fromTemplateId;
    this.telemetry.capture('template_selected', {
      template_id: template.metadata.id,
      template_categories: [...template.metadata.categories],
      from_template_id: sameTemplate ? null : fromTemplateId,
    });
  }
}
