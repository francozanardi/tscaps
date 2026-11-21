import { z } from 'zod';
import type { AlignmentConfig } from '@tscaps/engine';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import type { UpdateAlignmentAction } from '@core/sheets/actions/style/UpdateAlignmentAction';
import type { UpdateRotationAction } from '@core/sheets/actions/style/UpdateRotationAction';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

/**
 * `set_caption_position`: where a sheet's captions sit on the frame and
 * their angle, as the Position tab sets them. Everything named is
 * checked before anything is written. Placing captions is purely
 * visual: they are not laid out again, so every ref still holds.
 */
export class SetCaptionPositionOperation implements EditorOperation {
  readonly name = 'set_caption_position';
  readonly effect = 'edit';
  readonly description = [
    'Place a sheet\'s captions on the frame and turn them. Give only what changes (get_element on the sheet reads its position).',
    'The sheets linked to it follow. Nothing is re-split, so refs hold.',
  ].join(' ');

  private readonly input = new OperationInput({
    sheet: z.string().optional().describe('The sheet, as a ref: sheet:<id>. The active sheet when left out.'),
    verticalAlign: z.enum(['top', 'center', 'bottom']).optional().describe('Which edge of the caption block sits at verticalOffset.'),
    verticalOffset: z.number().min(0).max(1).optional().describe('Share of the video\'s height from the top (0.5 middle, 0.8 low).'),
    horizontalAlign: z.enum(['left', 'center', 'right', 'start', 'end']).optional()
      .describe('Which side sits at horizontalOffset; start and end follow the reading direction.'),
    horizontalOffset: z.number().min(0).max(1).optional()
      .describe('Share of the video\'s width from the left; for start and end, from the edge reading begins at.'),
    rotationDeg: z.number().min(-180).max(180).optional().describe('Angle in degrees, clockwise.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly sheets: SheetRefResolver,
    private readonly parser: EditorRefParser,
    private readonly updateAlignment: UpdateAlignmentAction,
    private readonly updateRotation: UpdateRotationAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused([...checked.problems]);
    const { sheet: sheetRef, rotationDeg, ...placement } = checked.value;
    const sheet = this.sheets.resolve(sheetRef);
    if (!sheet.ok) return this.refused([sheet.problem]);
    const alignment = this.alignmentPatchOf(placement);
    const changed = [...Object.keys(alignment), ...(rotationDeg === undefined ? [] : ['rotationDeg'])];
    if (changed.length === 0) return this.refused([this.problem('Name at least one setting to change.')]);
    const held = sheet.value.template.heldVerticalAlign();
    if (held !== null && alignment.verticalAlign !== undefined && alignment.verticalAlign !== held) {
      return this.refused([this.problem(`This template keeps its captions anchored at the ${held}; change verticalOffset instead.`)]);
    }

    if (Object.keys(alignment).length > 0) this.updateAlignment.execute(sheet.value.id, alignment);
    if (rotationDeg !== undefined) this.updateRotation.execute(sheet.value.id, { angleDeg: rotationDeg });
    const unrotated = rotationDeg === undefined ? null : this.unrotatedWarning(sheet.value);
    return {
      ok: true,
      output: { sheet: this.parser.formatOf('sheet', sheet.value.id), changed },
      problems: unrotated === null ? [] : [unrotated],
    };
  }

  /** The alignment fields the input names, and only those. */
  private alignmentPatchOf(placement: Placement): Partial<AlignmentConfig> {
    const patch: { -readonly [Key in keyof AlignmentConfig]?: AlignmentConfig[Key] } = {};
    if (placement.verticalAlign !== undefined) patch.verticalAlign = placement.verticalAlign;
    if (placement.verticalOffset !== undefined) patch.verticalOffset = placement.verticalOffset;
    if (placement.horizontalAlign !== undefined) patch.horizontalAlign = placement.horizontalAlign;
    if (placement.horizontalOffset !== undefined) patch.horizontalOffset = placement.horizontalOffset;
    return patch;
  }

  /** A warning when the sheet's CSS never reads the rotation, so the angle was stored and draws nothing; null when it does. */
  private unrotatedWarning(sheet: Sheet): OperationProblem | null {
    if (sheet.resolveCss().includes(TemplateCssVariable.ROTATION)) return null;
    return { severity: 'warning', message: `The rotation was stored, but this sheet's CSS never reads ${TemplateCssVariable.ROTATION}, so its captions do not turn.` };
  }

  private problem(message: string): OperationProblem {
    return { severity: 'error', message };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}

/** The alignment fields of the input, each left out or given. */
type Placement = { readonly [Key in keyof AlignmentConfig]?: AlignmentConfig[Key] | undefined };
