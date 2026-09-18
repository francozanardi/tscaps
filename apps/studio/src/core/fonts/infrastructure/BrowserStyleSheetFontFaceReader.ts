import type { FontFaceCssReader } from '@core/fonts/domain/FontFaceCssReader';
import type { FontFaceDeclaration } from '@core/fonts/domain/FontFaceDeclaration';

/**
 * Descriptors carried through untouched from the rule the page
 * registered. `font-weight` and `font-style` are how the browser tells
 * the faces of one family apart, so dropping them would collapse a
 * family onto whichever face happened to be read first.
 *
 * `font-family`, `src` and `unicode-range` are absent because they are
 * read into their own fields; the metric overrides are absent because
 * they are recomputed for the family being written.
 */
const CARRIED_DESCRIPTORS: readonly string[] = [
  'font-style',
  'font-weight',
  'font-stretch',
  'font-display',
  'font-feature-settings',
  'font-variation-settings',
  'font-language-override',
  'size-adjust',
];

/**
 * Walks `document.styleSheets` for `@font-face` rules whose declared
 * `font-family` matches one of the requested names. Recurses through
 * `@import`-loaded sheets so fonts pulled in via `@import '@fontsource…'`
 * from `fonts.css` are reachable. Cross-origin sheets throw on
 * `cssRules` access and are skipped silently — bundled Fontsource and
 * user-uploaded fonts are same-origin so they are always readable.
 *
 * Rules come back in the order the page registered them, which is the
 * order a family's own subsets were declared in.
 */
export class BrowserStyleSheetFontFaceReader implements FontFaceCssReader {
  read(families: ReadonlySet<string>): FontFaceDeclaration[] {
    if (families.size === 0) return [];
    const out: FontFaceDeclaration[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      // Generated output is never an input: literal rules would multiply on each reconciliation.
      if (sheet.ownerNode instanceof Element && sheet.ownerNode.hasAttribute('data-tscaps-compiled-fonts')) continue;
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
        out.push(this.declarationOf(rule, family));
      } else if (rule instanceof CSSImportRule && rule.styleSheet) {
        this.collect(rule.styleSheet, families, out);
      }
    }
  }

  private declarationOf(rule: CSSFontFaceRule, family: string): FontFaceDeclaration {
    return {
      family,
      source: rule.style.getPropertyValue('src'),
      unicodeRange: rule.style.getPropertyValue('unicode-range'),
      descriptors: this.carriedDescriptorsOf(rule),
      metrics: null,
    };
  }

  private carriedDescriptorsOf(rule: CSSFontFaceRule): ReadonlyMap<string, string> {
    const descriptors = new Map<string, string>();
    for (const name of CARRIED_DESCRIPTORS) {
      const value = rule.style.getPropertyValue(name);
      if (value) descriptors.set(name, value);
    }
    return descriptors;
  }

  private unquoteFamily(value: string): string {
    const trimmed = value.trim();
    if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }
}
