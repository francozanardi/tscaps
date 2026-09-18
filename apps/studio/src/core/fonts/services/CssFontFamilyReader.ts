const FONT_FAMILY_DECLARATION = /font-family\s*:\s*([^;}]+)/g;
const QUOTED_FAMILY_NAME = /['"]([^'"]+)['"]/g;

/**
 * Reads the family names a stylesheet asks for by writing them out.
 *
 * `var(...)` expressions are skipped, fallback argument and all: the
 * value the app sets always wins, so a family named only as a fallback
 * is one nothing will draw with.
 *
 */
export class CssFontFamilyReader {

  /**
   * The families each `font-family` declaration names, in the order it
   * names them, one entry per declaration.
   *
   * The order is part of the answer: the browser walks the list per
   * character and stops at the first family covering it, so a name is
   * only reachable for the alphabets no earlier name draws.
   */
  lists(css: string): string[][] {
    return this.declaredValues(css).map((value) => this.namesIn(value)).filter((names) => names.length > 0);
  }

  private declaredValues(css: string): string[] {
    return [...css.matchAll(FONT_FAMILY_DECLARATION)].map((declaration) => declaration[1]!);
  }

  private namesIn(value: string): string[] {
    return [...this.withoutVarExpressions(value).matchAll(QUOTED_FAMILY_NAME)].map((name) => name[1]!);
  }

  /**
   * Removes every `var(...)` expression, matching nested parentheses so
   * the whole expression drops out with its fallback.
   */
  private withoutVarExpressions(value: string): string {
    let result = '';
    let index = 0;
    while (index < value.length) {
      if (value.startsWith('var(', index)) {
        index = this.expressionEnd(value, index + 4);
        continue;
      }
      result += value[index];
      index++;
    }
    return result;
  }

  /** The index just past the `)` closing the expression opened at `openIndex`. */
  private expressionEnd(value: string, openIndex: number): number {
    let depth = 1;
    let index = openIndex;
    while (index < value.length && depth > 0) {
      const character = value[index]!;
      if (character === '(') depth++;
      else if (character === ')') depth--;
      index++;
    }
    return index;
  }
}
