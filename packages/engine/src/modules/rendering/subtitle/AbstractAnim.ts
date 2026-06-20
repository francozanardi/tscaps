import type { CssVariable } from '@modules/document/CssVariable';

/**
 * One animation timing extracted from a probed element's computed
 * style: the CSS variable whose start moment anchors the active
 * window, and the duration the rule runs for once that moment passes.
 * `durationS` is `Infinity` for an `animation-iteration-count:
 * infinite` rule.
 */
export interface AbstractAnim {
  cssVar: CssVariable;
  durationS: number;
}
