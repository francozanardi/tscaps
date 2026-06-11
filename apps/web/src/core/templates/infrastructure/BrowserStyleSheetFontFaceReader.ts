import type { FontFaceCssReader } from '@core/templates/domain/FontFaceCssReader';
import type { FontFaceDeclaration } from '@core/templates/domain/FontFaceDeclaration';

/**
 * Walks `document.styleSheets` for `@font-face` rules whose declared
 * `font-family` matches one of the requested names. Recurses through
 * `@import`-loaded sheets so fonts pulled in via `@import '@fontsource…'`
 * from `fonts.css` are reachable. Cross-origin sheets throw on
 * `cssRules` access and are skipped silently — bundled Fontsource and
 * user-uploaded fonts are same-origin so they are always readable.
 */
export class BrowserStyleSheetFontFaceReader implements FontFaceCssReader {
  read(families: ReadonlySet<string>): FontFaceDeclaration[] {
    if (families.size === 0) return [];
    const out: FontFaceDeclaration[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      this.collect(sheet, families, out);
    }
    return out;
  }

  private collect(sheet: CSSStyleSheet, families: ReadonlySet<string>, out: FontFaceDeclaration[]): void {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      return;
    }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSFontFaceRule) {
        const family = this.unquoteFamily(rule.style.getPropertyValue('font-family'));
        if (!families.has(family)) continue;
        out.push({
          cssText: rule.cssText,
          unicodeRange: rule.style.getPropertyValue('unicode-range'),
        });
      } else if (rule instanceof CSSImportRule && rule.styleSheet) {
        this.collect(rule.styleSheet, families, out);
      }
    }
  }

  private unquoteFamily(value: string): string {
    const trimmed = value.trim();
    if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }
}
