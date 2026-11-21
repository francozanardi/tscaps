import type { HistoryGroup } from '@core/editor/domain/HistoryGroup';
import type { EditorOperationRunner } from '@core/editor-operations/services/EditorOperationRunner';
import type { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SaveUserTemplateAction } from '@core/user-templates/actions/SaveUserTemplateAction';
import type { UserTemplate } from '@core/user-templates/domain/UserTemplate';

/** How saving a sheet's look ended: the template saved and whether the sheet now uses it, or why nothing was saved. */
export type SheetTemplateSaveOutcome =
  | { readonly ok: true; readonly template: { readonly id: string; readonly name: string }; readonly switchProblem: string | null }
  | { readonly ok: false; readonly problem: string };

/**
 * Saves a caption style sheet's look as it is now as a template of the
 * person's own, then switches the sheet to it, as the editor's *Save
 * current style as a new template* does. The saved template outlives the
 * project and no undo takes it back; switching the sheet joins
 * `historyGroup`'s checkpoint.
 */
export class SheetTemplateSaver {
  constructor(
    private readonly sheets: SheetRefResolver,
    private readonly save: SaveUserTemplateAction,
    private readonly runner: EditorOperationRunner,
  ) {}

  /** `sheetRef` is the sheet as a ref (`sheet:<id>`); the active one when undefined. */
  async saveAs(name: string, sheetRef: string | undefined, historyGroup: HistoryGroup): Promise<SheetTemplateSaveOutcome> {
    const sheet = this.sheets.resolve(sheetRef);
    if (!sheet.ok) return { ok: false, problem: sheet.problem.message };
    const saved = await this.saved(name, sheet.value);
    if ('problem' in saved) return { ok: false, problem: saved.problem };
    const { id, name: savedName } = saved.template.template.metadata;
    const switched = await this.runner.run('set_template', { template: id, ...(sheetRef === undefined ? {} : { sheet: sheetRef }) }, historyGroup);
    const switchProblem = switched.ok ? null : switched.problems.map((problem) => problem.message).join(' ');
    return { ok: true, template: { id, name: savedName }, switchProblem };
  }

  /** The template saved, or why it could not be (the name refused, the library full, the storage failing). */
  private async saved(name: string, sheet: Sheet): Promise<{ readonly template: UserTemplate } | { readonly problem: string }> {
    try {
      return { template: await this.save.execute({ name, sheet, parentTemplateId: sheet.template.metadata.id }) };
    } catch (error) {
      return { problem: `Not saved: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}
