const DEFINITION_PATTERN = /@(?:-webkit-|-moz-)?keyframes\s+([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
const ANIMATION_VALUE_PATTERN = /(?:animation-name|animation)\s*:\s*([^;{}]*)/g;
const IDENT_PATTERN = /(?<![\w.#-])-?[a-zA-Z_][a-zA-Z0-9_-]*/g;

/** Value tokens that are animation shorthand keywords, never a keyframes name. */
const ANIMATION_VALUE_KEYWORDS: ReadonlySet<string> = new Set([
  'none',
  'linear',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'step-start',
  'step-end',
  'infinite',
  'normal',
  'reverse',
  'alternate',
  'alternate-reverse',
  'forwards',
  'backwards',
  'both',
  'running',
  'paused',
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
  'important',
]);

/**
 * Extracts `@keyframes` names from a stylesheet: the names it defines
 * and the names its `animation` / `animation-name` declarations
 * reference. Comparing the two sets finds animations that can never
 * run because their keyframes are missing.
 *
 * Cheap regex scan rather than a CSS parse; pass the source through
 * {@link CssMinifier} first so commented-out rules don't count.
 * Function tokens (`cubic-bezier(…)`, `var(…)`, `steps(…)`) and
 * shorthand keywords are excluded from references, so what remains is
 * the author-chosen names. A custom property whose name ends in
 * `animation` counts as a reference too: it holds a shorthand for an
 * `animation` declaration to read through `var()`.
 */
export class CssKeyframesScanner {

  definedNames(css: string): Set<string> {
    const found = new Set<string>();
    for (const match of css.matchAll(DEFINITION_PATTERN)) {
      found.add(match[1]!);
    }
    return found;
  }

  referencedNames(css: string): Set<string> {
    const found = new Set<string>();
    for (const declaration of css.matchAll(ANIMATION_VALUE_PATTERN)) {
      this.collectNameTokens(this.emptyFunctionArguments(declaration[1]!), found);
    }
    return found;
  }

  /**
   * Clears what sits between a function's parentheses while keeping the
   * parentheses themselves, so `steps(2, end)` becomes `steps()`.
   * Arguments can hold bare identifiers — `end` and `start` in
   * `steps()`, `jump-none` and friends — that are indistinguishable
   * from a keyframes name once the enclosing call is gone. Keeping the
   * `(` lets the function's own name still be recognised as a function
   * rather than collected as a reference.
   */
  private emptyFunctionArguments(value: string): string {
    let depth = 0;
    let out = '';
    for (const char of value) {
      if (char === '(') {
        depth++;
        if (depth === 1) out += char;
      } else if (char === ')') {
        if (depth === 1) out += char;
        if (depth > 0) depth--;
      } else if (depth === 0) {
        out += char;
      }
    }
    return out;
  }

  private collectNameTokens(value: string, found: Set<string>): void {
    for (const match of value.matchAll(IDENT_PATTERN)) {
      const token = match[0];
      if (ANIMATION_VALUE_KEYWORDS.has(token)) continue;
      if (this.isFunctionToken(value, match.index + token.length)) continue;
      found.add(token);
    }
  }

  private isFunctionToken(value: string, indexAfterToken: number): boolean {
    return value[indexAfterToken] === '(';
  }
}
