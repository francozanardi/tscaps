/**
 * Strips CSS block comments (`/* … *\/`) from a stylesheet, leaving
 * whitespace and rule structure untouched.
 *
 * Comment-like sequences inside string literals are preserved. An
 * unterminated comment drops everything from its opening to the end
 * of the input — matching what browsers do when they encounter one.
 */
export class CssMinifier {
  minify(css: string): string {
    let result = '';
    let i = 0;
    let stringDelim: '"' | "'" | null = null;
    while (i < css.length) {
      const ch = css[i]!;
      if (stringDelim) {
        result += ch;
        if (ch === '\\' && i + 1 < css.length) {
          result += css[i + 1];
          i += 2;
          continue;
        }
        if (ch === stringDelim) stringDelim = null;
        i++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        stringDelim = ch;
        result += ch;
        i++;
        continue;
      }
      if (ch === '/' && css[i + 1] === '*') {
        const end = css.indexOf('*/', i + 2);
        if (end === -1) break;
        i = end + 2;
        continue;
      }
      result += ch;
      i++;
    }
    return result;
  }
}
