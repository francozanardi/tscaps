import { z } from 'zod';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import type { LinkSheetAction } from '@core/sheets/actions/LinkSheetAction';
import type { RenameSheetAction } from '@core/sheets/actions/RenameSheetAction';
import type { UnlinkSheetAction } from '@core/sheets/actions/UnlinkSheetAction';
import type { Sheet } from '@core/sheets/domain/Sheet';

const MAX_NAME_CHARS = 40;

/**
 * `edit_sheet`: renames a caption style sheet, and links it to another
 * sheet's look or unlinks it, as the sheet chip's menu does. Linked
 * sheets share every style edit and keep their own preset (colours).
 */
export class EditSheetOperation implements EditorOperation {
  readonly name = 'edit_sheet';
  readonly effect = 'edit';
  readonly description = [
    'Rename a caption style sheet, or link it to another sheet so both share every later style edit (each keeps its own preset, such as its colours: the way speaker sheets work), or unlink it with `linkedTo: null`.',
    'Linking makes the sheet take the other one\'s look now. Give `name`, `linkedTo`, or both.',
  ].join(' ');

  private readonly input = new OperationInput({
    sheet: z.string().describe('The sheet, as a ref: sheet:<id>.'),
    name: z.string().trim().min(1).max(MAX_NAME_CHARS).optional().describe('Its new name.'),
    linkedTo: z.string().nullable().optional().describe('The sheet to link it to, as a ref, or null to unlink it.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
    private readonly sheets: SheetRefResolver,
    private readonly rename: RenameSheetAction,
    private readonly link: LinkSheetAction,
    private readonly unlink: UnlinkSheetAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { name, linkedTo } = checked.value;
    if (name === undefined && linkedTo === undefined) return this.refused([this.error('Give name, linkedTo, or both.')]);
    const sheet = this.sheets.resolve(checked.value.sheet);
    if (!sheet.ok) return this.refused([sheet.problem]);
    const partner = linkedTo === undefined || linkedTo === null ? null : this.sheets.resolve(linkedTo);
    if (partner !== null && !partner.ok) return this.refused([partner.problem]);
    if (partner !== null && partner.ok && partner.value.id === sheet.value.id) return this.refused([this.error('A sheet cannot be linked to itself.')]);

    if (name !== undefined) this.rename.execute(sheet.value.id, name);
    if (linkedTo === null) this.unlink.execute(sheet.value.id);
    if (partner !== null && partner.ok) this.linkTo(sheet.value, partner.value);
    return { ok: true, output: this.outputOf(sheet.value.id), problems: [] };
  }

  /** Puts `sheet` in `partner`'s link group, leaving the group it was in first. */
  private linkTo(sheet: Sheet, partner: Sheet): void {
    if (sheet.linkGroupId !== null && sheet.linkGroupId === partner.linkGroupId) return;
    if (sheet.linkGroupId !== null) this.unlink.execute(sheet.id);
    this.link.execute(sheet.id, partner.id);
  }

  private outputOf(sheetId: string): Record<string, unknown> {
    const sheets = this.store.snapshot().sheets;
    const sheet = sheets.find((candidate) => candidate.id === sheetId);
    const linked = sheet?.linkGroupId === null || sheet === undefined
      ? []
      : sheets.filter((other) => other.id !== sheetId && other.linkGroupId === sheet.linkGroupId).map((other) => this.parser.formatOf('sheet', other.id));
    return { sheet: this.parser.formatOf('sheet', sheetId), name: sheet?.name ?? null, linkedWith: linked };
  }

  private error(message: string): OperationProblem {
    return { severity: 'error', message };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
