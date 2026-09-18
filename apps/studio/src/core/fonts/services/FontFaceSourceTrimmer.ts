const WOFF2_SOURCE = /format\(\s*['"]?woff2['"]?\s*\)|\.woff2\b/i;

// Plain woff, and never woff2: `\b` after the name fails against the `2`,
// and the closing paren fails against `format('woff2')`.
const LEGACY_WOFF_SOURCE = /format\(\s*['"]?woff['"]?\s*\)|\.woff\b/i;

/**
 * Drops the woff a `@font-face` rule offers beside its woff2.
 *
 * Font packages ship a family in both, for browsers predating the newer
 * format, and every source a rule lists gets fetched and embedded whole.
 * The older one is embedded for nobody: the browser rasterizing the
 * frames is the one running the app, and it has read woff2 for years.
 * Dropping it takes its bytes out of every frame the export draws.
 *
 * Nothing else is touched. A rule offering no woff2 keeps whatever it
 * has — an uploaded font arrives in the format its file was, and that
 * file is the one to embed — and a `local()` source stays, since a face
 * already on the machine is the cheapest of all.
 */
export class FontFaceSourceTrimmer {

  /** A rule's `src` value with the superseded sources dropped, or the value itself when there are none. */
  trim(source: string): string {
    const sources = this.splitTopLevel(source);
    if (!sources.some((one) => WOFF2_SOURCE.test(one))) return source;
    const kept = sources.filter((one) => !LEGACY_WOFF_SOURCE.test(one));
    if (kept.length === sources.length) return source;
    return kept.map((one) => one.trim()).join(', ');
  }

  /** Splits on the commas separating sources, leaving those inside `url(...)` alone. */
  private splitTopLevel(value: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let current = '';
    for (const character of value) {
      if (character === '(') depth++;
      else if (character === ')') depth--;
      if (character === ',' && depth === 0) {
        out.push(current);
        current = '';
        continue;
      }
      current += character;
    }
    out.push(current);
    return out;
  }
}
