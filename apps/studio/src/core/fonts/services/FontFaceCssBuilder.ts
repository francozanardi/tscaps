import type { FontFaceCssReader } from '@core/fonts/domain/FontFaceCssReader';
import type { FontFaceCssWriter } from '@core/fonts/services/FontFaceCssWriter';
import type { UnicodeRangeParser } from '@core/fonts/services/UnicodeRangeParser';

/**
 * Builds the concatenated `@font-face` CSS for the requested families,
 * under the names they already carry, trimmed to the subsets whose
 * `unicode-range` covers characters the text actually holds. Font
 * payloads subsetted by `unicode-range` (Fontsource, Google Fonts) come
 * down to the minimum needed.
 */
export class FontFaceCssBuilder {

  constructor(
    private readonly reader: FontFaceCssReader,
    private readonly parser: UnicodeRangeParser,
    private readonly writer: FontFaceCssWriter,
  ) {}

  /** `usedCodepoints` as `null` keeps every subset the families declare. */
  build(families: ReadonlySet<string>, usedCodepoints: ReadonlySet<number> | null): string {
    return this.reader.read(families)
      .filter((declaration) => this.covers(declaration.unicodeRange, usedCodepoints))
      .map((declaration) => this.writer.write(declaration))
      .join('\n');
  }

  private covers(unicodeRange: string, usedCodepoints: ReadonlySet<number> | null): boolean {
    return usedCodepoints === null || this.parser.parse(unicodeRange).intersectsAny(usedCodepoints);
  }
}
