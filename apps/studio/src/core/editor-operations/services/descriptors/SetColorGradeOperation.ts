import { z } from 'zod';
import type { SetColorGradeAction } from '@core/color-grade/actions/SetColorGradeAction';
import { ColorGrade, type ColorGradeField } from '@core/color-grade/domain/ColorGrade';
import type { ColorGradeLooks } from '@core/color-grade/domain/ColorGradeLook';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import { OperationInput } from '@core/editor-operations/services/OperationInput';

/**
 * `set_color_grade`: grades the whole picture beneath the captions —
 * the video and every layer over it — from a look, from the grade it
 * has, or from neutral, with each adjustment given set on top.
 */
export class SetColorGradeOperation implements EditorOperation {
  readonly name = 'set_color_grade';
  readonly effect = 'edit';
  readonly description = [
    'Grade the colour of the whole picture beneath the captions: the video and every b-roll, picture and graphic over it.',
    'A look sets every adjustment at once; the adjustments given are then set on top of the look, or of the grade the video has when no look is given.',
    'look none, or every adjustment at 0, takes the grade off. Answers the grade now in place.',
  ].join(' ');

  private readonly input = new OperationInput({
    look: z.string().optional()
      .describe('A ready-made look to start from: none (neutral), warm, cool, vivid, bright, moody, matte, vintage or mono (black and white); list_catalog looks for what each sets.'),
    exposure: this.adjustment('exposure', 'From a stop darker (-1) to a stop brighter (1).'),
    contrast: this.adjustment('contrast', 'From flat (-1) to doubled (1), about mid grey.'),
    saturation: this.adjustment('saturation', 'From grey (-1) to doubled colour (1).'),
    temperature: this.adjustment('temperature', 'From cooler, bluer (-1) to warmer, redder (1).'),
    tint: this.adjustment('tint', 'From greener (-1) to more magenta (1).'),
    vignette: this.adjustment('vignette', 'How far the corners darken, from not at all (0) to fully (1).'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly looks: ColorGradeLooks,
    private readonly setGrade: SetColorGradeAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { look: lookId, ...adjustments } = checked.value;
    const given = ColorGrade.fields().filter((field) => adjustments[field] !== undefined);
    if (lookId === undefined && given.length === 0) return this.refusedFor('Give a look or at least one adjustment.');
    const look = lookId === undefined ? null : this.looks.list().find((each) => each.id === lookId) ?? null;
    if (lookId !== undefined && look === null) {
      return this.refusedFor(`"${lookId}" is not a look. Looks: ${this.looks.list().map((each) => each.id).join(', ')}.`);
    }
    const base = look?.grade ?? this.store.snapshot().colorGrade;
    const grade = given.reduce((graded, field) => graded.with(field, adjustments[field] ?? 0), base);
    this.setGrade.execute(grade);
    return this.answered();
  }

  private answered(): OperationResult {
    const grade = this.store.snapshot().colorGrade;
    const values = Object.fromEntries(ColorGrade.fields().map((field) => [field, grade.valueOf(field)]));
    return { ok: true, output: { look: this.looks.lookOf(grade)?.id ?? null, grade: values }, problems: [] };
  }

  private adjustment(field: ColorGradeField, meaning: string) {
    const [min, max] = ColorGrade.rangeOf(field);
    return z.number().min(min).max(max).optional().describe(`${meaning} 0 is neutral.`);
  }

  private refusedFor(message: string): OperationResult {
    return this.refused([{ severity: 'error', message }]);
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
