import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { RoleSheetProvisioner } from '@core/sheets/services/RoleSheetProvisioner';
import type { RunSheetMatcherAction } from '@core/sheet-matchers/actions/RunSheetMatcherAction';
import type { TagSheetMatcher } from '@core/sheet-matchers/services/TagSheetMatcher';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import { MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';
import { SHEET_ROLES, type SheetRole } from '@core/sheets/domain/SheetRole';

/**
 * Adds the sheet for a narrative role and hands it the content that
 * belongs to it: the words the tagger marked with the role's tag, carved
 * out of the scenes they sit in so the rest of each scene stays where it
 * was.
 *
 * Creating the sheet and filling it are one gesture, so they share one
 * undo entry — undoing halfway would leave an empty sheet nobody asked
 * for. No-ops when the role already has a sheet; a role is unique per
 * project and its content is reassigned, not duplicated.
 */
export class CreateRoleSheetAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly roleSheetProvisioner: RoleSheetProvisioner,
    private readonly runSheetMatcher: RunSheetMatcherAction,
    private readonly tagSheetMatcher: TagSheetMatcher,
    private readonly telemetry: Telemetry,
  ) {}

  execute(role: SheetRole): string | null {
    const { sheets, availableTemplates } = this.store.snapshot();
    const main = sheets.find((sheet) => sheet.id === MAIN_SHEET_ID);
    if (!main) return null;
    if (this.roleSheetProvisioner.find(role, sheets)) return null;

    const definition = SHEET_ROLES[role];
    const sheet = this.roleSheetProvisioner.create(role, main, availableTemplates);
    const undoKey = `role-sheet:${role}`;

    this.store.commit(undoKey);
    this.store.patch({ sheets: [...sheets, sheet], activeSheetId: sheet.id });

    const moved = this.runSheetMatcher.execute(
      sheet.id,
      this.tagSheetMatcher,
      { tagName: definition.tagName },
      undoKey,
    );
    this.refresh.execute();
    this.telemetry.capture('sheet_created', { source: 'role', role, moved_words: moved.movedCount });
    return sheet.id;
  }
}
