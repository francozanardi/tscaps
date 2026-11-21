import { DocumentEditor, type Document } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { RoleSheetProvisioner } from '@core/sheets/services/RoleSheetProvisioner';
import { Sheet, HOOK_SHEET_ID, MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';

const docEditor = new DocumentEditor();

/**
 * Reroutes the video's opening scenes to the Hook sheet in one undoable
 * step. The set of segment ids describes which scenes should belong to
 * Hook after the action — segments already routed to Hook that are
 * absent from the set are moved back to Main, and segments in the set
 * that were not in Hook are moved into it.
 *
 * When the target set is non-empty and no Hook sheet exists yet, one is
 * created from a hook template (or a Main clone as fallback) with the
 * fixed hook id and color. When the target set is empty and a Hook
 * sheet exists, its scenes are remapped to Main and the sheet is
 * removed — Hook exists only while it has assigned scenes.
 *
 * The contiguous-from-start invariant is a UI concern; this action
 * routes whichever ids it receives.
 */
export class SetHookScenesAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly roleSheetProvisioner: RoleSheetProvisioner,
    private readonly telemetry: Telemetry,
  ) {}

  execute(targetSegmentIds: ReadonlySet<string>): void {
    const { document, sheets, availableTemplates } = this.store.snapshot();
    if (!document) return;
    const main = sheets.find((s) => s.id === MAIN_SHEET_ID);
    if (!main) return;

    const existingHook = this.roleSheetProvisioner.find('hook', sheets);
    const currentHookIds = this.currentHookSegmentIds(document);
    if (this.sameSet(currentHookIds, targetSegmentIds)) return;

    this.store.commit('Set hook scenes');

    if (targetSegmentIds.size === 0) {
      this.applyEmptyTarget(document, sheets, existingHook);
      this.refresh.execute();
      this.telemetry.capture('hook_scenes_set', { scene_count: 0 });
      return;
    }

    const hookSheet = existingHook ?? this.roleSheetProvisioner.create('hook', main, availableTemplates);
    const nextDocument = this.rerouteSegments(document, currentHookIds, targetSegmentIds);
    const nextSheets = existingHook ? sheets : [...sheets, hookSheet];

    this.store.patch({
      sheets: nextSheets,
      document: nextDocument,
      activeSheetId: hookSheet.id,
    });
    this.refresh.execute();
    this.telemetry.capture('hook_scenes_set', { scene_count: targetSegmentIds.size });
  }

  private applyEmptyTarget(
    document: Document,
    sheets: ReadonlyArray<Sheet>,
    existingHook: Sheet | null,
  ): void {
    if (!existingHook) return;
    const nextDocument = docEditor.remapKind(document, HOOK_SHEET_ID, MAIN_SHEET_ID);
    const nextSheets = sheets.filter((s) => s.id !== HOOK_SHEET_ID);
    const { activeSheetId } = this.store.snapshot();
    this.store.patch({
      sheets: nextSheets,
      document: nextDocument,
      activeSheetId: activeSheetId === HOOK_SHEET_ID ? MAIN_SHEET_ID : activeSheetId,
    });
  }

  private rerouteSegments(
    document: Document,
    currentHookIds: ReadonlySet<string>,
    targetHookIds: ReadonlySet<string>,
  ): Document {
    let next = document;
    for (const segment of document.getSegments()) {
      const shouldBeHook = targetHookIds.has(segment.id);
      const isHook = currentHookIds.has(segment.id);
      if (shouldBeHook === isHook) continue;
      const targetKind = shouldBeHook ? HOOK_SHEET_ID : MAIN_SHEET_ID;
      next = docEditor.replaceSegmentWithKind(next, segment.id, [segment], targetKind);
    }
    return next;
  }

  private currentHookSegmentIds(document: Document): ReadonlySet<string> {
    const ids = new Set<string>();
    for (const section of document.sections) {
      if (section.kind !== HOOK_SHEET_ID) continue;
      for (const segment of section.segments) ids.add(segment.id);
    }
    return ids;
  }

  private sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
    if (a.size !== b.size) return false;
    for (const id of a) if (!b.has(id)) return false;
    return true;
  }
}
