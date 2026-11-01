import type { EditorStore } from '@core/editor/store/EditorStore';
import type { Template } from '@core/templates/domain/Template';
import type { RecordTemplateUseAction } from '@core/templates/actions/RecordTemplateUseAction';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import type { SheetElementResolver } from '@core/sheets/domain/SheetElementResolver';

/**
 * Applies a Template to the currently active Sheet — resetting style
 * values, splitter configs, alignment, and effects — and records the
 * pick as recently used. When the sheet belongs to a link group, every
 * linked sibling switches to the same template while each keeps its own
 * `variantIndex`, so a multi-speaker group rebases together and each
 * speaker lands on its matching preset in the new look — including after
 * a detour through a template that ships no presets at all.
 *
 * Per-element styles and behind-actor overrides recorded against
 * anything under the sheet — segments, lines, words, decorations — are
 * cleared alongside the sheet-level fields: the new template's CSS
 * knows nothing about the old one's variables, so a leftover word
 * colour or a leftover segment size would render against a variable
 * that no longer exists.
 *
 * Every sheet the switch changes the splitters of — the one picked for,
 * and any linked sibling — lets go of the scenes shaped by hand under
 * it: split, merged, inserted, retyped or timed. That shape was drawn
 * against the old rules, so the new ones lay those scenes out again;
 * text edits and word timings stay, since they belong to the words. A
 * template that cuts captions the way the sheet already did keeps them,
 * which is what a template saved from the sheet itself does. All of it
 * is one undo step with the switch.
 */
export class SetTemplateAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly recordTemplateUse: RecordTemplateUseAction,
    private readonly telemetry: Telemetry,
    private readonly linkedSheetsSync: LinkedSheetsSync,
    private readonly sheetElementResolver: SheetElementResolver,
  ) {}

  execute(template: Template): void {
    const snap = this.store.snapshot();
    const activeSheet = this.store.activeSheet();
    if (!activeSheet) return;
    const fromTemplateId = activeSheet.template.metadata.id;
    const sheets = this.linkedSheetsSync.applyTemplateEdit(activeSheet.withTemplate(template), snap.sheets);

    const elementIds = this.sheetElementResolver.elementsOf(activeSheet.id);
    const relaidOut = this.elementsUnder(this.sheetsWithNewSplitters(snap.sheets, sheets));

    this.store.commit();
    this.store.patch({
      sheets,
      elementStyles: snap.elementStyles.without(elementIds),
      behindActorOverrides: snap.behindActorOverrides.without(elementIds),
      frozenSegments: snap.frozenSegments.withoutStructurallyEdited(relaidOut),
    });
    this.refresh.execute();
    this.recordTemplateUse.execute(template.metadata.id);
    this.captureTemplateSelected(template, fromTemplateId);
  }

  private sheetsWithNewSplitters(before: ReadonlyArray<Sheet>, after: ReadonlyArray<Sheet>): ReadonlySet<string> {
    const ids = new Set<string>();
    for (const sheet of after) {
      const previous = before.find((candidate) => candidate.id === sheet.id);
      if (previous && !previous.splitsLike(sheet)) ids.add(sheet.id);
    }
    return ids;
  }

  private elementsUnder(sheetIds: ReadonlySet<string>): ReadonlySet<string> {
    const ids = new Set<string>();
    for (const sheetId of sheetIds) {
      for (const elementId of this.sheetElementResolver.elementsOf(sheetId)) ids.add(elementId);
    }
    return ids;
  }

  private captureTemplateSelected(template: Template, fromTemplateId: string): void {
    const sameTemplate = template.metadata.id === fromTemplateId;
    this.telemetry.capture('template_selected', {
      template_id: template.metadata.id,
      template_category: template.metadata.category,
      from_template_id: sameTemplate ? null : fromTemplateId,
    });
  }
}
