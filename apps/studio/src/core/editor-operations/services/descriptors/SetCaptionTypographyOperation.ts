import { z } from 'zod';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { ActiveSheetEditRunner } from '@core/editor-operations/services/ActiveSheetEditRunner';
import type { CaptionReflowDetector } from '@core/editor-operations/services/CaptionReflowDetector';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import { FONT_STACKS } from '@core/fonts/domain/FontStackCatalog';
import type { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import type { UpdateSheetVariantAction } from '@core/sheets/actions/style/UpdateSheetVariantAction';
import type { UpdateTypographyAction } from '@core/sheets/actions/style/UpdateTypographyAction';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { TypographyConfig } from '@core/sheets/domain/TypographyConfig';

const FONT_FAMILIES = FONT_STACKS.map((stack) => stack.faces.latin);

/**
 * `set_caption_typography`: how a sheet's captions are set, as the
 * Style tab's typography rows set them: font, size, weight, spacing,
 * case, italics, alignment inside the caption block, and the template's
 * preset. Everything named is checked before anything is written; the
 * captions are laid out again before it answers.
 */
export class SetCaptionTypographyOperation implements EditorOperation {
  readonly name = 'set_caption_typography';
  readonly effect = 'edit';
  readonly description = [
    'Set the type of a sheet\'s captions: font, size, weight, spacing, case, italics, alignment, and the template\'s preset (one of its colour variants).',
    'Give only what changes (get_element on the sheet reads them and the presets). To make captions bigger, raise sizeCqh (4 is a usual size, 6 is big).',
    'Changes every caption painted with that sheet and the sheets linked to it; per-element CSS still wins over it. Captions are re-split into lines after a size, font or spacing change, so segment and line refs may change.',
  ].join(' ');

  private readonly input = new OperationInput({
    sheet: z.string().optional().describe('The sheet, as a ref: sheet:<id>. The active sheet when left out.'),
    font: z.string().optional().describe(`The font family, one of: ${FONT_FAMILIES.join(', ')}.`),
    sizeCqh: z.number().min(1).max(15).optional().describe('Font size, in percent of the video\'s height (1 to 15).'),
    weight: z.number().int().min(100).max(900).optional().describe('Font weight, 100 to 900 in steps of 100.'),
    letterSpacingEm: z.number().min(-0.1).max(0.5).optional().describe('Space between letters, in em.'),
    wordSpacingEm: z.number().min(-0.2).max(1).optional().describe('Extra space between words, in em.'),
    lineSpacingEm: z.number().min(-0.5).max(1).optional().describe('Extra space between lines, in em.'),
    case: z.enum(['none', 'uppercase', 'lowercase']).optional().describe('Letter case the captions are shown in.'),
    italic: z.boolean().optional(),
    align: z.enum(['start', 'center', 'end']).optional().describe('How lines align inside the caption block: start and end follow the language\'s reading direction.'),
    preset: z.string().optional().describe('One of the template\'s presets, by its name (get_element on the sheet lists them).'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly sheets: SheetRefResolver,
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
    private readonly fonts: FontStackLibrary,
    private readonly activeSheetEdits: ActiveSheetEditRunner,
    private readonly updateTypography: UpdateTypographyAction,
    private readonly updateVariant: UpdateSheetVariantAction,
    private readonly refresh: RefreshDocumentAction,
    private readonly reflow: CaptionReflowDetector,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { sheet: sheetRef, preset, ...settings } = checked.value;
    const sheet = this.sheets.resolve(sheetRef);
    if (!sheet.ok) return this.refused([sheet.problem]);
    const typography = this.typographyPatch(settings);
    if (!typography.ok) return this.refused([typography.problem]);
    const variantIndex = this.variantIndexOf(sheet.value, preset);
    if (!variantIndex.ok) return this.refused([variantIndex.problem]);
    const changed = [...Object.keys(typography.value), ...(variantIndex.value === null ? [] : ['preset'])];
    if (changed.length === 0) return this.refused([this.problem('Name at least one setting to change.')]);

    const before = this.store.snapshot().document;
    // A preset re-seeds the template's control values, so it goes first and the explicit settings land over it.
    if (variantIndex.value !== null) {
      const index = variantIndex.value;
      this.activeSheetEdits.runOn(sheet.value.id, () => this.updateVariant.execute(index));
    }
    if (Object.keys(typography.value).length > 0) this.updateTypography.execute(sheet.value.id, typography.value);
    this.refresh.execute();
    const reflowed = this.reflow.warningFor(before, this.store.snapshot().document);
    return {
      ok: true,
      output: { sheet: this.parser.formatOf('sheet', sheet.value.id), changed },
      problems: reflowed === null ? [] : [reflowed],
    };
  }

  private typographyPatch(settings: Record<string, unknown>): Checked<Partial<TypographyConfig>> {
    const patch: { -readonly [Key in keyof TypographyConfig]?: TypographyConfig[Key] } = {};
    if (typeof settings['font'] === 'string') {
      const wanted = settings['font'].toLowerCase();
      const stack = FONT_STACKS.find((each) => each.faces.latin.toLowerCase() === wanted || each.id === wanted);
      if (stack === undefined) return this.wrong(`There is no font "${settings['font']}". Fonts: ${FONT_FAMILIES.join(', ')}.`);
      patch.fontStack = this.fonts.stackFor(stack.id);
    }
    if (typeof settings['sizeCqh'] === 'number') patch.fontSize = settings['sizeCqh'];
    if (typeof settings['weight'] === 'number') patch.fontWeight = settings['weight'];
    if (typeof settings['letterSpacingEm'] === 'number') patch.letterSpacing = settings['letterSpacingEm'];
    if (typeof settings['wordSpacingEm'] === 'number') patch.wordSpacing = settings['wordSpacingEm'];
    if (typeof settings['lineSpacingEm'] === 'number') patch.lineSpacing = settings['lineSpacingEm'];
    if (settings['case'] !== undefined) patch.textCase = settings['case'] as TypographyConfig['textCase'];
    if (typeof settings['italic'] === 'boolean') patch.italic = settings['italic'];
    if (settings['align'] !== undefined) patch.textAlign = settings['align'] as TypographyConfig['textAlign'];
    return { ok: true, value: patch };
  }

  private variantIndexOf(sheet: Sheet, preset: string | undefined): Checked<number | null> {
    if (preset === undefined) return { ok: true, value: null };
    const names = sheet.template.variants.map((variant) => variant.label);
    const index = names.findIndex((name) => name.toLowerCase() === preset.toLowerCase());
    if (index < 0) return this.wrong(names.length === 0 ? 'This template has no presets.' : `There is no preset "${preset}". Presets: ${names.join(', ')}.`);
    return { ok: true, value: index === sheet.resolveVariantIndex() ? null : index };
  }

  private wrong<T>(message: string): Checked<T> {
    return { ok: false, problem: this.problem(message) };
  }

  private problem(message: string): OperationProblem {
    return { severity: 'error', message };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}

/** A setting checked: its value, or the problem to answer with. */
type Checked<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly problem: OperationProblem };
