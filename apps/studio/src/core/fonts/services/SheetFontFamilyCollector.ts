import type { Document } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

const FONT_FAMILY_DECLARATION = /font-family\s*:\s*([^;}]+)/g;
const QUOTED_FAMILY_NAME = /['"]([^'"]+)['"]/g;

export interface SheetFontFamilyCollectorInput {
  readonly sheet: Sheet;
  readonly document: Document;
  readonly inlineStyles: Record<string, string>;
  readonly sheetCss: string;
  readonly wordOverrides: WordStyleOverrideRegistry;
  readonly segmentOverrides: SegmentOverrides;
}

/**
 * Builds the deduplicated set of font families a sheet will render
 * with at export time, drawn from every source that can introduce a
 * family:
 *
 *  1. The sheet's primary typography font.
 *  2. Per-word and per-segment `fontFamily` overrides.
 *  3. The user's value for every `font`-typed styleControl the
 *     template exposes.
 *  4. Family names hard-coded in the template CSS — quoted literals
 *     *outside* `var(...)` expressions. `var(...)` fallbacks are
 *     skipped because the user-set value via sources 1–3 always wins;
 *     embedding their unused fonts would bundle ~50–200 KB of payload
 *     per rendered frame for nothing.
 *
 * The result is meant to feed `FontFaceCssBuilder.build` so each
 * frame's embedded stylesheet ships only the `@font-face` blocks the
 * captions actually use.
 */
export class SheetFontFamilyCollector {

  collect(input: SheetFontFamilyCollectorInput): Set<string> {
    const families = new Set<string>();
    this.addPrimaryFamily(input.inlineStyles, families);
    this.addPerElementOverrideFamilies(input, families);
    this.addFontControlFamilies(input.sheet, input.inlineStyles, families);
    this.addCssLiteralFamilies(input.sheetCss, families);
    return families;
  }

  private addPrimaryFamily(inlineStyles: Record<string, string>, out: Set<string>): void {
    const value = inlineStyles[TemplateCssVariable.FONT_FAMILY];
    if (value) out.add(this.unquote(value));
  }

  private addPerElementOverrideFamilies(input: SheetFontFamilyCollectorInput, out: Set<string>): void {
    for (const section of input.document.sections) {
      if (section.kind !== input.sheet.id) continue;
      for (const segment of section.segments) {
        const segFf = input.segmentOverrides.getStyle(segment.id).fontFamily;
        if (segFf) out.add(segFf);
        for (const line of segment.lines) {
          for (const word of line.words) {
            const wordFf = input.wordOverrides.get(word.id).fontFamily;
            if (wordFf) out.add(wordFf);
          }
        }
      }
    }
  }

  private addFontControlFamilies(sheet: Sheet, inlineStyles: Record<string, string>, out: Set<string>): void {
    for (const control of sheet.template.styleControls) {
      if (control.type !== 'font') continue;
      const value = inlineStyles[`--tscaps-${control.id}`];
      if (value) out.add(this.unquote(value));
    }
  }

  private addCssLiteralFamilies(css: string, out: Set<string>): void {
    for (const declaration of css.matchAll(FONT_FAMILY_DECLARATION)) {
      const withoutVars = this.stripVarExpressions(declaration[1]!);
      for (const family of withoutVars.matchAll(QUOTED_FAMILY_NAME)) {
        out.add(family[1]!);
      }
    }
  }

  /**
   * Removes every `var(...)` expression from `value`, matching nested
   * parentheses so the entire expression (including its fallback
   * argument) drops out cleanly.
   */
  private stripVarExpressions(value: string): string {
    let result = '';
    let i = 0;
    while (i < value.length) {
      if (value.startsWith('var(', i)) {
        i = this.findParenExpressionEnd(value, i + 4);
        continue;
      }
      result += value[i];
      i++;
    }
    return result;
  }

  /** Returns the index just past the `)` that closes the parenthesised expression starting at `openParenIndex`. */
  private findParenExpressionEnd(value: string, openParenIndex: number): number {
    let depth = 1;
    let i = openParenIndex;
    while (i < value.length && depth > 0) {
      const ch = value[i]!;
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      i++;
    }
    return i;
  }

  /**
   * Strips wrapping single/double quotes. Sheet inline-style values
   * for font controls arrive quoted (`'Press Start 2P'`) since
   * digit-leading idents are otherwise invalid CSS; the bare name is
   * what matches the bundled `@font-face` declarations.
   */
  private unquote(value: string): string {
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      return value.slice(1, -1);
    }
    return value;
  }
}
