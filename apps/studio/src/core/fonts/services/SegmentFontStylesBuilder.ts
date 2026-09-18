import type { Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { FontStack } from '@core/fonts/domain/FontStack';
import type { FontStackResolver } from '@core/fonts/services/FontStackResolver';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

const NO_VARS: Readonly<Record<string, string>> = {};

/**
 * Derives the font declarations one segment needs, which are the ones
 * for elements the reader gave a font of their own.
 *
 * Nothing is declared for the rest. The sheet's stack compiles to a
 * single family that carries every writing system its captions hold, so
 * a word in an alphabet the sheet is not mostly written in already draws
 * on the right face with the right box — there is nothing for an element
 * below to correct.
 *
 * What an element's own record holds is a stack, and its CSS spells that
 * stack out so the text stays readable and reproducible. What renders is
 * the family that stack compiles to, which the record cannot name: it
 * depends on the alphabets the captions are written in, and those change
 * as the captions do. So it is layered on top here, one segment at a
 * time, in the shape both render paths consume — so the preview and the
 * burned file reach the same answer instead of each deciding on its own.
 */
export class SegmentFontStylesBuilder {

  constructor(private readonly fontStackResolver: FontStackResolver) {}

  /**
   * Font variable overriding the segment's chosen stack with its
   * resolved value. Empty when the segment was never given one.
   * Spread after the segment's own inline styles so the resolved value
   * wins.
   */
  buildSegmentFontVars(sheet: Sheet, segment: Segment, elementStyles: ElementStyles): Readonly<Record<string, string>> {
    return this.fontVarsFor(segment.id, sheet, elementStyles) ?? NO_VARS;
  }

  /**
   * Font variables for the lines given a stack of their own, keyed by
   * line id. Lines given none are absent. Each set is spread after the
   * line's own inline styles so the resolved value wins.
   */
  buildLineFontVars(
    sheet: Sheet,
    segment: Segment,
    elementStyles: ElementStyles,
  ): ReadonlyMap<string, Readonly<Record<string, string>>> {
    const vars = new Map<string, Readonly<Record<string, string>>>();
    for (const line of segment.lines) {
      const declared = this.fontVarsFor(line.id, sheet, elementStyles);
      if (declared !== null) vars.set(line.id, declared);
    }
    return vars;
  }

  /** Per-word `font-family` values keyed by word id. Words given no font of their own are absent. */
  buildWordFontFamilies(sheet: Sheet, segment: Segment, elementStyles: ElementStyles): ReadonlyMap<string, string> {
    const families = new Map<string, string>();
    for (const word of segment.getWords()) {
      const stack = elementStyles.fieldStack(word.id, ElementFieldId.FONT_FAMILY);
      if (stack !== null) families.set(word.id, this.resolve(stack, sheet));
    }
    return families;
  }

  private fontVarsFor(
    elementId: string,
    sheet: Sheet,
    elementStyles: ElementStyles,
  ): Readonly<Record<string, string>> | null {
    const stack = elementStyles.fieldStack(elementId, ElementFieldId.FONT_FAMILY);
    if (stack === null) return null;
    return { [TemplateCssVariable.FONT_FAMILY]: this.resolve(stack, sheet) };
  }

  private resolve(stack: FontStack, sheet: Sheet): string {
    return this.fontStackResolver.resolve(stack, sheet.scripts);
  }
}
