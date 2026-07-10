import type { FontFaceCssReader } from '@core/fonts/domain/FontFaceCssReader';
import type { UnicodeRangeParser } from '@core/fonts/services/UnicodeRangeParser';

/**
 * Builds the concatenated `@font-face` CSS for the requested families,
 * trimmed to only those subsets whose `unicode-range` actually covers
 * the characters the document uses. Trims font payloads subsetted by
 * `unicode-range` (Fontsource, Google Fonts) down to the minimum needed.
 */
export class FontFaceCssBuilder {

  constructor(
    private readonly reader: FontFaceCssReader,
    private readonly parser: UnicodeRangeParser,
  ) {}

  build(families: ReadonlySet<string>, usedCodepoints: ReadonlySet<number>): string {
    const declarations = this.reader.read(families);
    const filtered = declarations.filter((d) =>
      this.parser.parse(d.unicodeRange).intersectsAny(usedCodepoints),
    );
    return filtered.map((d) => d.cssText).join('\n');
  }
}
