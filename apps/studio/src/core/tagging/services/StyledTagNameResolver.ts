import type { CssMinifier, CssSelectorClassScanner } from '@tscaps/engine';
import { TAG_NAMES, type TagName } from '@core/tagging/domain/TagName';

/**
 * Answers which semantic tags a stylesheet paints, from the class
 * names its selectors match on. A tag outside the answer is one a
 * word can carry with nothing to show for it.
 */
export class StyledTagNameResolver {
  constructor(
    private readonly minifier: CssMinifier,
    private readonly selectorClassScanner: CssSelectorClassScanner,
  ) {}

  /**
   * Pass a sheet's resolved CSS rather than its template's for the
   * answer to follow an edit made in the Code tab. Selectors nested
   * inside a style rule are not read, which can report a styled tag
   * as unstyled and never the reverse.
   */
  resolve(css: string): ReadonlySet<TagName> {
    // Minified first so a rule left inside a comment does not count.
    const selectorClasses = this.selectorClassScanner.scan(this.minifier.minify(css));
    return new Set(TAG_NAMES.filter((name) => selectorClasses.has(name)));
  }
}
