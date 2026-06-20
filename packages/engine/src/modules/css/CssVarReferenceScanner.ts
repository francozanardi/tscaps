const VAR_REFERENCE_PATTERN = /var\(\s*(--[a-zA-Z0-9_-]+)/g;

/**
 * Returns every CSS custom property name referenced via `var(--name)`
 * anywhere in the given source.
 *
 * Cheap regex scan rather than a CSS parse. False positives are
 * limited to literal `var(--…)` substrings inside string values; pass
 * the source through {@link CssMinifier} first to drop comments that
 * would otherwise contribute to the result.
 */
export class CssVarReferenceScanner {

  scan(css: string): Set<string> {
    const found = new Set<string>();
    for (const match of css.matchAll(VAR_REFERENCE_PATTERN)) {
      found.add(match[1]!);
    }
    return found;
  }
}
