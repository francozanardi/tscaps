import type { EditorState } from '@core/editor/domain/EditorState';
import type { AnimationValue } from '@core/elements/domain/AnimationValue';
import { SHEET_ANIMATION_SCOPES } from '@core/elements/domain/ElementAnimationScope';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SheetAnimation } from '@core/sheets/domain/SheetAnimation';
import type { TypographyConfig } from '@core/sheets/domain/TypographyConfig';
import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import type { AnimationReadout, ElementStyleReadout } from '@core/editor-operations/services/ElementStyleReadout';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';


/** A part of a sheet's code that is answered only on request. */
export type SheetCodePart = 'css' | 'filtersSvg';

/** What a sheet answered for one kind under it: an animation in place of the template's, or values tuned inside the template's. */
type SheetAnimationReadout = AnimationReadout | { readonly tuned: Readonly<Record<string, string>> };

/** The settings of a sheet the assistant sets, by the names its tools take them under. */
export interface SheetSettingsReadout {
  readonly typography: Readonly<Record<string, unknown>>;
  readonly position: Readonly<Record<string, unknown>>;
  readonly effects: Readonly<Record<string, unknown>>;
  /** Each style control's value, by the control's id. */
  readonly styleControls: Readonly<Record<string, unknown>>;
}

/**
 * Reads one style sheet for a read answer: its template and preset, the
 * typography and position of its captions, the effects
 * set_caption_effects turns on or off, every style control of its
 * template with the value it holds now and the range it takes, the
 * animations it set, and its CSS and SVG filters where they were
 * edited. The template's own CSS and filters are not repeated.
 */
export class SheetReadout {
  constructor(
    private readonly parser: EditorRefParser,
    private readonly styles: ElementStyleReadout,
    private readonly format: ReadoutFormatter,
  ) {}

  /** Everything about `sheet`, a sheet of the project `state`. */
  detail(sheet: Sheet, state: EditorState): Record<string, unknown> {
    const { template } = sheet;
    const animations = this.animationsOf(sheet);
    return {
      ref: this.parser.formatOf('sheet', sheet.id),
      kind: 'sheet',
      name: sheet.name,
      ...(sheet.id === state.activeSheetId ? { active: true } : {}),
      ...(sheet.role === null ? {} : { role: sheet.role }),
      template: { id: template.metadata.id, name: template.metadata.name },
      ...(template.variants.length === 0
        ? {}
        : { preset: template.variants[sheet.resolveVariantIndex()]?.label, presets: template.variants.map((variant) => variant.label) }),
      segments: this.segmentCountOf(sheet, state),
      typography: this.typographyOf(sheet.typographyConfig),
      position: this.positionOf(sheet),
      effects: this.effectsOf(sheet),
      styleControls: template.styleControls.map((control) => this.styleControlOf(control, sheet.styleValues.values[control.id])),
      ...(animations === null ? {} : { animations }),
      cssOverride: sheet.cssOverride === null ? null : this.format.text(sheet.cssOverride),
      ...(sheet.filtersSvgOverride === null ? {} : { filtersSvgOverride: this.format.text(sheet.filtersSvgOverride) }),
    };
  }

  /**
   * The sheet's whole CSS or SVG filters, as they apply now: its own
   * where they were edited, else its template's (the filters empty where
   * the template ships none). Long inline images read as placeholders,
   * as everywhere else.
   */
  codeOf(sheet: Sheet, parts: ReadonlyArray<SheetCodePart>): Record<string, string> {
    return Object.fromEntries(parts.map((part) => [part, this.format.text(part === 'css'
      ? sheet.cssOverride ?? sheet.template.getCss()
      : sheet.filtersSvgOverride ?? sheet.template.getFiltersSvg())]));
  }

  /** The settings of `sheet` the assistant sets, valued as {@link detail} answers them. */
  settingsOf(sheet: Sheet): SheetSettingsReadout {
    return {
      typography: this.typographyOf(sheet.typographyConfig),
      position: this.positionOf(sheet),
      effects: this.effectsOf(sheet),
      styleControls: Object.fromEntries(sheet.template.styleControls.map((control) => [
        control.id,
        this.format.value(sheet.styleValues.values[control.id] ?? control.default),
      ])),
    };
  }

  private positionOf(sheet: Sheet): Record<string, unknown> {
    return {
      verticalAlign: sheet.alignmentConfig.verticalAlign,
      verticalOffset: this.format.share(sheet.alignmentConfig.verticalOffset),
      horizontalAlign: sheet.alignmentConfig.horizontalAlign,
      horizontalOffset: this.format.share(sheet.alignmentConfig.horizontalOffset),
      rotationDeg: sheet.rotationConfig.angleDeg,
    };
  }

  /** By set_caption_effects' names; an effect the sheet has no settings for is left out. */
  private effectsOf(sheet: Sheet): Record<string, unknown> {
    const emoji = sheet.effectConfig('emoji');
    const lowercase = sheet.effectConfig('smart_lowercase');
    const punctuation = sheet.effectConfig('remove_punctuation');
    return {
      ...(emoji === null ? {} : { automaticEmojis: emoji.enabled, emojiPlacement: emoji.placement }),
      ...(lowercase === null ? {} : { lowercase: lowercase.enabled }),
      ...(punctuation === null ? {} : { removePunctuation: punctuation.enabled }),
    };
  }

  private segmentCountOf(sheet: Sheet, state: EditorState): number {
    return (state.document?.sections ?? [])
      .filter((section) => section.kind === sheet.id)
      .reduce((sum, section) => sum + section.segments.length, 0);
  }

  /** Sizes in cqh (% of the frame's height), spacings in em; a spacing at 0 and a style left off are left out. */
  private typographyOf(typography: TypographyConfig): Record<string, unknown> {
    return {
      font: typography.fontStack.familyFor('latin'),
      sizeCqh: this.format.share(typography.fontSize),
      weight: typography.fontWeight,
      ...(typography.letterSpacing === 0 ? {} : { letterSpacingEm: this.format.share(typography.letterSpacing) }),
      ...(typography.wordSpacing === 0 ? {} : { wordSpacingEm: this.format.share(typography.wordSpacing) }),
      ...(typography.lineSpacing === 0 ? {} : { lineSpacingEm: this.format.share(typography.lineSpacing) }),
      ...(typography.textCase === 'none' ? {} : { case: typography.textCase }),
      align: typography.textAlign,
      ...(typography.italic ? { italic: true } : {}),
      ...(typography.underline ? { underline: true } : {}),
      ...(typography.strikethrough ? { strikethrough: true } : {}),
    };
  }

  private styleControlOf(control: ControlField, value: ControlValue | undefined): Record<string, unknown> {
    return {
      id: control.id,
      label: control.label,
      kind: control.type,
      value: this.format.value(value ?? control.default),
      ...(control.min === undefined ? {} : { min: control.min }),
      ...(control.max === undefined ? {} : { max: control.max }),
      ...(control.step === undefined ? {} : { step: control.step }),
      ...(control.unit === undefined ? {} : { unit: control.unit }),
      ...(control.options === undefined ? {} : { options: control.options.map((option) => ({ value: option.value, label: option.label })) }),
    };
  }

  /** By scope (segments, words, emojis), what the sheet answered; null where it answered nothing and the template decides. */
  private animationsOf(sheet: Sheet): Record<string, SheetAnimationReadout> | null {
    const answers = SHEET_ANIMATION_SCOPES.flatMap((scope) => {
      const answer = sheet.animations.get(scope);
      return answer === null ? [] : [[scope, this.answerOf(answer)] as const];
    });
    return answers.length === 0 ? null : Object.fromEntries(answers);
  }

  private answerOf(answer: SheetAnimation): SheetAnimationReadout {
    if (answer.kind === 'replaced') return this.styles.animation(answer.animation);
    return { tuned: Object.fromEntries(Object.entries(answer.values).map(([property, value]) => [property, this.valueText(value)])) };
  }

  private valueText(value: AnimationValue): string {
    return value.kind === 'number' ? `${value.amount}${value.unit}` : value.text;
  }
}
