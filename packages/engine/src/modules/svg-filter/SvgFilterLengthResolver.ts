import type { SvgFilterLengthFactors } from '@modules/svg-filter/SvgFilterScopeProvider';

// Matches a numeric magnitude immediately followed by `em` or `cqh`,
// e.g. `0.25em` or `-3cqh`. The required digit before the unit keeps
// it from touching identifiers that merely end in those letters
// (`result="problem"`, `flood-color="lemonchiffon"`).
const RELATIVE_LENGTH_RE = /(-?\d*\.?\d+)(em|cqh)\b/g;

/**
 * Rewrites font/viewport-relative length tokens (`em`, `cqh`) in a
 * materialized SVG filter body to absolute user-space px.
 *
 * SVG filter primitive attributes (`radius`, `stdDeviation`, `dx`,
 * `dy`, …) accept neither relative units nor `calc()`, so a filter
 * that must track the text size is authored in `em`/`cqh` and resolved
 * here, once per render — the px-per-`em` factor depends on the render
 * target height, which varies between renders. Runs after
 * `SvgFilter.materialize`, so the relative units come either from the
 * author's literals or from substituted style-control values.
 */
export class SvgFilterLengthResolver {
  resolve(body: string, factors: SvgFilterLengthFactors): string {
    return body.replace(RELATIVE_LENGTH_RE, (_match, magnitude: string, unit: string) => {
      const factor = unit === 'em' ? factors.pxPerEm : factors.pxPerCqh;
      const px = parseFloat(magnitude) * factor;
      return String(Math.round(px * 1000) / 1000);
    });
  }
}
