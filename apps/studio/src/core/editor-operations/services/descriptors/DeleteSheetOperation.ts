import { z } from 'zod';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { CaptionReflowDetector } from '@core/editor-operations/services/CaptionReflowDetector';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import type { DeleteSheetAction } from '@core/sheets/actions/DeleteSheetAction';
import { MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';

/**
 * `delete_sheet`: removes a caption style sheet other than the main one;
 * its scenes go back to the main sheet.
 */
export class DeleteSheetOperation implements EditorOperation {
  readonly name = 'delete_sheet';
  readonly effect = 'edit';
  readonly description = [
    'Remove a caption style sheet; its scenes go back to the main sheet and take its look. The main sheet cannot be removed.',
    'To take the hook\'s look away, use set_hook_captions with an empty list instead.',
  ].join(' ');

  private readonly input = new OperationInput({
    sheet: z.string().describe('The sheet, as a ref: sheet:<id>.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
    private readonly sheets: SheetRefResolver,
    private readonly reflow: CaptionReflowDetector,
    private readonly deleteSheet: DeleteSheetAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const sheet = this.sheets.resolve(checked.value.sheet);
    if (!sheet.ok) return this.refused([sheet.problem]);
    if (sheet.value.id === MAIN_SHEET_ID) return this.refused([{ severity: 'error', message: 'The main sheet cannot be removed.', ref: checked.value.sheet }]);
    const before = this.store.snapshot().document;
    this.deleteSheet.execute(sheet.value.id);
    const reflowed = this.reflow.warningFor(before, this.store.snapshot().document);
    return {
      ok: true,
      output: { deleted: this.parser.formatOf('sheet', sheet.value.id), scenesNowOn: this.parser.formatOf('sheet', MAIN_SHEET_ID) },
      problems: reflowed === null ? [] : [reflowed],
    };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
