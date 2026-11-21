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
import type { UpdateStyleControlAction } from '@core/sheets/actions/style/UpdateStyleControlAction';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';

type StyleControlInput = string | number | boolean;

/** One value of the input, with the control of the sheet's template it is for and the value the control will hold. */
interface ControlWrite {
  readonly field: ControlField;
  readonly value: StyleControlInput;
  readonly stored: ControlValue;
}

type CheckedWrites =
  | { readonly ok: true; readonly value: ReadonlyArray<ControlWrite> }
  | { readonly ok: false; readonly problems: ReadonlyArray<OperationProblem> };

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const MAX_TEXT_CHARS = 200;
// What the panel's slider spans when the template names no bound.
const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;
const LISTED_AT_MOST = 15;
const FONT_FAMILIES = FONT_STACKS.map((stack) => stack.faces.latin);

/**
 * `set_style_controls`: sets style controls of a sheet's template, the
 * named dials it offers, as the Style tab does; a font control takes a
 * catalog stack for every alphabet, and an image control is refused. Every id and
 * value is checked against the template before anything is written,
 * and a value equal to what the control holds is not written again.
 * The captions are laid out again before it answers, so what reads or
 * renders them next sees the new values.
 */
export class SetStyleControlsOperation implements EditorOperation {
  readonly name = 'set_style_controls';
  readonly effect = 'edit';
  readonly description = [
    'Set style controls of a sheet\'s template: the named dials it offers (colours, sizes, toggles, choices; list_catalog lists each template\'s).',
    'Changes every caption painted with that sheet, and the sheets linked to it (one per speaker); per-element styles still win over it.',
    'Values: a colour as #rrggbb or #rrggbbaa, a number within the control\'s range in its unit, a toggle as true or false, a choice as one of its option values, text as text, a font as a family set_caption_typography takes. Image controls are not set here.',
    'Prefer this over set_sheet_css whenever a control does what is wanted.',
  ].join(' ');

  private readonly input = new OperationInput({
    values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .describe('The new values, by control id, e.g. {"primary-color": "#ffd400"}.'),
    sheet: z.string().optional().describe('The sheet, as a ref: sheet:<id>. The active sheet when left out.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly sheets: SheetRefResolver,
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
    private readonly activeSheetEdits: ActiveSheetEditRunner,
    private readonly updateStyleControl: UpdateStyleControlAction,
    private readonly fonts: FontStackLibrary,
    private readonly refresh: RefreshDocumentAction,
    private readonly reflow: CaptionReflowDetector,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const sheet = this.sheets.resolve(checked.value.sheet);
    if (!sheet.ok) return this.refused([sheet.problem]);
    const writes = this.checkedWrites(sheet.value, checked.value.values);
    if (!writes.ok) return this.refused(writes.problems);

    const changing = writes.value.filter(({ field, stored }) => !this.holds(sheet.value.styleValues.values[field.id], stored));
    const before = this.store.snapshot().document;
    if (changing.length > 0) {
      this.activeSheetEdits.runOn(sheet.value.id, () => {
        for (const write of changing) this.write(write);
      });
      this.refresh.execute();
    }
    const reflowed = this.reflow.warningFor(before, this.store.snapshot().document);
    return {
      ok: true,
      output: { sheet: this.parser.formatOf('sheet', sheet.value.id), changed: changing.map(({ field }) => field.id) },
      problems: reflowed === null ? [] : [reflowed],
    };
  }

  private write({ field, stored }: ControlWrite): void {
    this.updateStyleControl.execute(field, stored);
  }

  /** Whether a control holding `held` already holds `wanted`; a font's faces are compared one by one. */
  private holds(held: ControlValue | undefined, wanted: ControlValue): boolean {
    if (typeof wanted !== 'object' || typeof held !== 'object') return held === wanted;
    const slots = new Set([...Object.keys(held), ...Object.keys(wanted)]) as Set<keyof typeof wanted>;
    return [...slots].every((slot) => held[slot] === wanted[slot]);
  }

  private checkedWrites(sheet: Sheet, values: Readonly<Record<string, StyleControlInput>>): CheckedWrites {
    const entries = Object.entries(values);
    if (entries.length === 0) return { ok: false, problems: [this.problem('values is empty: name at least one control.')] };
    const writes: ControlWrite[] = [];
    const problems: OperationProblem[] = [];
    for (const [id, value] of entries) {
      const field = sheet.template.styleControls.find((candidate) => candidate.id === id);
      const wrong = field === undefined ? this.unknownControl(sheet, id) : this.valueProblem(field, value);
      if (wrong !== null) problems.push(this.problem(wrong));
      else if (field !== undefined) writes.push({ field, value, stored: this.storedValueOf(field, value) });
    }
    return problems.length > 0 ? { ok: false, problems } : { ok: true, value: writes };
  }

  private unknownControl(sheet: Sheet, id: string): string {
    const known = sheet.template.styleControls.map((field) => this.summary(field));
    const shown = known.slice(0, LISTED_AT_MOST).join(', ');
    const more = known.length > LISTED_AT_MOST ? ', … (list_catalog for all)' : '';
    return `${sheet.template.metadata.name} has no control "${id}". Its controls: ${shown || 'none'}${more}.`;
  }

  /** What the control holds once given `value`, a value that fits it. */
  private storedValueOf(field: ControlField, value: StyleControlInput): ControlValue {
    if (field.type === 'font' && typeof value === 'string') {
      const stack = this.catalogStackNamed(value);
      if (stack !== undefined) return this.fonts.stackFor(stack.id).toSnapshot();
    }
    return value;
  }

  /** What is wrong with `value` for `field`, or null when it fits. */
  private valueProblem(field: ControlField, value: StyleControlInput): string | null {
    switch (field.type) {
      case 'color':
        return typeof value === 'string' && HEX_COLOR.test(value) ? null : `${field.id} takes a colour as #rrggbb or #rrggbbaa, not ${JSON.stringify(value)}.`;
      case 'integer':
        return typeof value === 'number' && Number.isInteger(value) && this.inRange(field, value) ? null : `${this.summary(field)} does not take ${JSON.stringify(value)}.`;
      case 'float':
        return typeof value === 'number' && Number.isFinite(value) && this.inRange(field, value) ? null : `${this.summary(field)} does not take ${JSON.stringify(value)}.`;
      case 'toggle':
        return typeof value === 'boolean' ? null : `${field.id} is a toggle: give true or false.`;
      case 'select':
        return (field.options ?? []).some((option) => option.value === value) ? null : `${this.summary(field)} does not take ${JSON.stringify(value)}.`;
      case 'text':
        return typeof value === 'string' && value.length <= MAX_TEXT_CHARS ? null : `${field.id} takes text of at most ${MAX_TEXT_CHARS} characters.`;
      case 'image':
        return `${field.id} is an image control, which cannot be set here.`;
      case 'font':
        return typeof value === 'string' && this.catalogStackNamed(value) !== undefined ? null : `${field.id} takes one of the fonts: ${FONT_FAMILIES.join(', ')}.`;
    }
  }

  /** The catalog's stack whose Latin face, or whose id, is `name` in any case. */
  private catalogStackNamed(name: string): (typeof FONT_STACKS)[number] | undefined {
    const wanted = name.toLowerCase();
    return FONT_STACKS.find((stack) => stack.faces.latin.toLowerCase() === wanted || stack.id === wanted);
  }

  private inRange(field: ControlField, value: number): boolean {
    return value >= (field.min ?? DEFAULT_MIN) && value <= (field.max ?? DEFAULT_MAX);
  }

  /** A control as a caller reads it: its id, then its type with its range and unit, or its options. */
  private summary(field: ControlField): string {
    if (field.type === 'integer' || field.type === 'float') {
      const unit = field.unit === undefined ? '' : ` ${field.unit}`;
      return `${field.id} (${field.type} ${field.min ?? DEFAULT_MIN} to ${field.max ?? DEFAULT_MAX}${unit})`;
    }
    if (field.type === 'select') return `${field.id} (${(field.options ?? []).map((option) => option.value).join(' | ')})`;
    return `${field.id} (${field.type})`;
  }

  private problem(message: string): OperationProblem {
    return { severity: 'error', message };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
