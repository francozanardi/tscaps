import { z } from 'zod';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SetElementCssAction } from '@core/elements/actions/SetElementCssAction';
import type { SetElementFieldAction } from '@core/elements/actions/SetElementFieldAction';
import type { SetElementPlacementAction } from '@core/elements/actions/SetElementPlacementAction';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementPlacement } from '@core/elements/domain/ElementPlacement';
import type { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import type { CssControlledFieldFinder } from '@core/elements/services/css/CssControlledFieldFinder';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { FieldShadowingDeclarations } from '@core/elements/services/css/FieldShadowingDeclarations';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { ResolvedRef } from '@core/editor-operations/domain/ResolvedRef';
import type { CaptionElement, CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import type { CaptionSceneLocator } from '@core/editor-operations/services/CaptionSceneLocator';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import { FONT_STACKS } from '@core/fonts/domain/FontStackCatalog';
import type { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';

const MAX_ELEMENTS = 200;
const FONT_FAMILIES = FONT_STACKS.map((stack) => stack.faces.latin);
const HEX_COLOR = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** One field to write on an element: the value it records, or null to take it off. */
interface FieldWrite {
  readonly control: AuthoredElementControl;
  readonly value: ElementControlValue | null;
}

/** Everything the call writes on one element, checked. `placement` is left out when the call names none. */
interface ElementWrite {
  readonly element: CaptionElement;
  readonly fields: ReadonlyArray<FieldWrite>;
  readonly placement?: ElementPlacement | null;
}

/** A frame point the call places elements at, as shares of the frame's width and height. */
interface FramePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * `set_caption_element_style`: what the inspector's Style tab sets on a
 * caption segment, line, word or emoji: its own fields (italics,
 * underline, strikethrough, font, size, weight, colour, rotation), each
 * written as the field and its declaration together, and its own place
 * in the frame. A declaration in the element's own CSS that would hide a
 * field given a value (`font-size` beside the size field) is taken out,
 * so the value asked for is the one that shows, and the answer says so.
 * The same values go on every element named; everything is checked
 * before anything is written.
 */
export class SetCaptionElementStyleOperation implements EditorOperation {
  readonly name = 'set_caption_element_style';
  readonly effect = 'edit';
  readonly description = [
    'Set caption elements\' own text fields and place in the frame, as the inspector does. Prefer it to set_element_css.',
    'Every element named gets the same values; give only what changes. null takes a field or the placement off.',
    'Emojis take only relative-size and rotation; lines cannot be placed. get_element reads them back under style.',
  ].join(' ');

  private readonly input = new OperationInput({
    elements: z.array(z.string()).min(1).max(MAX_ELEMENTS).describe('Refs: segment:<id>, line:<id>, word:<id> or decoration:<id>.'),
    fields: z.strictObject({
      'italic': z.boolean().nullable().optional(),
      'underline': z.boolean().nullable().optional(),
      'strikethrough': z.boolean().nullable().optional(),
      'font-family': z.string().nullable().optional().describe('A font set_caption_typography lists.'),
      'font-size': z.number().nullable().optional().describe('Segments and lines: percent of the video height, 1 to 25.'),
      'relative-size': z.number().nullable().optional().describe('Words and emojis: percent of the text around, 10 to 400.'),
      'font-weight': z.number().nullable().optional().describe('100 to 900.'),
      'primary-color': z.string().nullable().optional().describe('#rrggbb or #rrggbbaa.'),
      'rotation': z.number().nullable().optional().describe('Degrees clockwise, -180 to 180.'),
    }).optional(),
    placement: z.strictObject({ x: z.number(), y: z.number() }).nullable().optional()
      .describe('Its centre, as shares (0 to 1) of the frame from the top left; null puts it back in its caption.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly captions: CaptionRefResolver,
    private readonly scenes: CaptionSceneLocator,
    private readonly store: EditorStore,
    private readonly catalog: StyledElementCatalog,
    private readonly fonts: FontStackLibrary,
    private readonly cssControlledFields: CssControlledFieldFinder,
    private readonly setField: SetElementFieldAction,
    private readonly setPlacement: SetElementPlacementAction,
    private readonly shadows: FieldShadowingDeclarations,
    private readonly setCss: SetElementCssAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { elements, fields = {}, placement } = checked.value;
    const asked = Object.entries(fields).filter(([, value]) => value !== undefined);
    if (asked.length === 0 && placement === undefined) return this.refused([{ severity: 'error', message: 'Name at least one field, or a placement.' }]);

    const resolved = elements.map((ref) => this.checkedWrite(ref, asked, placement));
    const problems = resolved.flatMap((each) => (each.ok ? [] : [each.problem]));
    if (problems.length > 0) return this.refused(problems);
    const writes = resolved.flatMap((each) => (each.ok ? [each.value] : []));

    const warnings = writes.flatMap((write) => [...this.handTakenWarnings(write), ...this.heldEdgeWarnings(write)]);
    const unhidden: OperationProblem[] = [];
    const changed = writes.flatMap((write) => {
      const taken = this.unhidden(write);
      unhidden.push(...taken);
      return this.written(write) || taken.length > 0 ? [write.element.ref] : [];
    });
    return { ok: true, output: { changed }, problems: [...unhidden, ...warnings] };
  }

  private checkedWrite(ref: string, asked: ReadonlyArray<readonly [string, unknown]>, point: FramePoint | null | undefined): ResolvedRef<ElementWrite> {
    const resolved = this.captions.resolve(ref);
    if (!resolved.ok) return resolved;
    const element = resolved.value;
    const fields: FieldWrite[] = [];
    for (const [fieldId, value] of asked) {
      const field = this.fieldWrite(element, fieldId, value);
      if (!field.ok) return field;
      fields.push(field.value);
    }
    if (point === undefined) return { ok: true, value: { element, fields } };
    const placement = this.placementFor(element, point);
    if (!placement.ok) return placement;
    return { ok: true, value: { element, fields, placement: placement.value } };
  }

  private fieldWrite(element: CaptionElement, fieldId: string, value: unknown): ResolvedRef<FieldWrite> {
    const control = this.catalog.controlFor(element.kind, fieldId as ElementFieldId);
    if (control === null) {
      const offered = this.catalog.controlsFor(element.kind).map((each) => each.id).join(', ');
      return this.problem(element.ref, `${element.ref} is a ${element.kind}, which has no ${fieldId}; a ${element.kind} takes ${offered}.`);
    }
    if (value === null) return { ok: true, value: { control, value: null } };
    const written = this.valueFor(control, value);
    if (written === null) return this.problem(element.ref, `${fieldId} takes ${this.takenBy(control)}, not ${JSON.stringify(value)}.`);
    return { ok: true, value: { control, value: written } };
  }

  /** What the field records for `value`, or null when the field does not take it. */
  private valueFor(control: AuthoredElementControl, value: unknown): ElementControlValue | null {
    switch (control.type) {
      case 'toggle':
        return typeof value === 'boolean' ? control.options?.[value ? 1 : 0]?.value ?? null : null;
      case 'number':
        return typeof value === 'number' && value >= (control.min ?? -Infinity) && value <= (control.max ?? Infinity) ? value : null;
      case 'color':
        return typeof value === 'string' && HEX_COLOR.test(value) ? value : null;
      case 'font':
        return typeof value === 'string' ? this.fontStackFor(value) : null;
      case 'select':
        return (control.options ?? []).some((option) => option.value === value) ? value as string : null;
    }
  }

  /** What a field takes, as a caller reads it. */
  private takenBy(control: AuthoredElementControl): string {
    switch (control.type) {
      case 'toggle':
        return 'true or false';
      case 'number':
        return `a number from ${control.min} to ${control.max}`;
      case 'color':
        return '#rrggbb or #rrggbbaa';
      case 'font':
        return `one of ${FONT_FAMILIES.join(', ')}`;
      case 'select':
        return `one of ${(control.options ?? []).map((option) => option.value).join(', ')}`;
    }
  }

  private fontStackFor(family: string): ElementControlValue | null {
    const wanted = family.toLowerCase();
    const stack = FONT_STACKS.find((each) => each.faces.latin.toLowerCase() === wanted || each.id === wanted);
    return stack === undefined ? null : this.fonts.stackFor(stack.id).toSnapshot();
  }

  /**
   * The placement that puts the element's centre at `point`. A segment
   * on a template that holds its vertical anchor keeps that edge, as a
   * drag on the preview does, since its layout is built from it.
   */
  private placementFor(element: CaptionElement, point: FramePoint | null): ResolvedRef<ElementPlacement | null> {
    if (!this.catalog.canBePlaced(element.kind)) {
      return this.problem(element.ref, `${element.ref} is a line, which stays where its caption lays it out; place its segment or its words.`);
    }
    if (point === null) return { ok: true, value: null };
    if ([point.x, point.y].some((share) => share < 0 || share > 1)) return this.problem(element.ref, 'placement x and y are shares of the frame, from 0 to 1.');
    return {
      ok: true,
      value: {
        verticalAlign: (element.kind === 'segment' ? this.heldVerticalAlign(element) : null) ?? 'center',
        verticalOffset: point.y,
        horizontalAlign: 'center',
        horizontalOffset: point.x,
      },
    };
  }

  private heldVerticalAlign(element: CaptionElement): ElementPlacement['verticalAlign'] | null {
    const document = this.store.snapshot().document;
    const scene = document === null ? null : this.scenes.sceneOf(document, element.kind, element.id);
    const sheet = scene === null ? null : this.store.sheet(scene.sheetId);
    return sheet?.template.heldVerticalAlign() ?? null;
  }

  /**
   * Warnings for fields to be taken off whose declaration was since
   * edited by hand: taking the field off leaves that declaration, so the
   * look does not change. Read before anything is written.
   */
  private handTakenWarnings(write: ElementWrite): OperationProblem[] {
    const clearing = write.fields.filter((field) => field.value === null).map((field) => field.control);
    const style = this.store.snapshot().elementStyles.get(write.element.id);
    const taken = this.cssControlledFields.find(style, clearing);
    return clearing.filter((control) => taken.has(control.id)).map((control) => ({
      severity: 'warning',
      message: `The CSS of ${write.element.ref} still sets ${control.property}, so taking ${control.id} off does not change how it looks; change it with set_element_css.`,
      ref: write.element.ref,
    }));
  }

  /** A warning for a segment placed by an edge its template holds rather than by its centre. */
  private heldEdgeWarnings(write: ElementWrite): OperationProblem[] {
    const edge = write.placement?.verticalAlign ?? 'center';
    if (edge === 'center') return [];
    return [{
      severity: 'warning',
      message: `The template of ${write.element.ref} keeps its captions anchored at the ${edge}, so y placed its ${edge} edge rather than its centre.`,
      ref: write.element.ref,
    }];
  }

  /**
   * Takes out of the element's own CSS the declarations that would hide
   * the fields `write` gives a value, and says which went.
   */
  private unhidden(write: ElementWrite): OperationProblem[] {
    const css = this.store.snapshot().elementStyles.get(write.element.id)?.css ?? '';
    const given = write.fields.filter((field) => field.value !== null).map((field) => field.control);
    const hiding = given.flatMap((control) => {
      const declaration = this.shadows.find(css, control);
      return declaration === null ? [] : [{ control, text: declaration.text }];
    });
    if (hiding.length === 0) return [];
    this.setCss.execute(write.element.id, write.element.kind, hiding.reduce((next, each) => this.shadows.without(next, each.control), css));
    return hiding.map(({ control, text }) => ({
      severity: 'warning',
      message: `Took \`${text}\` out of the CSS of ${write.element.ref}: it hid ${control.id}, which now shows.`,
      ref: write.element.ref,
    }));
  }

  /** Writes everything `write` holds on its element; answers whether the element's style changed. */
  private written(write: ElementWrite): boolean {
    const { id, kind } = write.element;
    const before = this.store.snapshot().elementStyles.get(id);
    for (const { control, value } of write.fields) {
      if (value === null) this.setField.clear(id, kind, control);
      else this.setField.execute(id, kind, control, value);
    }
    if (write.placement === null) this.setPlacement.clear(id, kind);
    else if (write.placement !== undefined) this.setPlacement.execute(id, kind, write.placement);
    return this.store.snapshot().elementStyles.get(id) !== before;
  }

  private problem<T>(ref: string, message: string): ResolvedRef<T> {
    return { ok: false, problem: { severity: 'error', message, ref } };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
