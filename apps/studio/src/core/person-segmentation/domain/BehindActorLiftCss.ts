import { CssVariable } from '@tscaps/engine';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

/**
 * Export-side counterpart of the preview's wrapper lift: raises the
 * caption by the template's `behind-lift` control while the effect is
 * active. Appended after the template CSS for sheets that opt into
 * behind-actor, so it reads the template-composed
 * `--behind-actor-active` and its `translate` wins over any template
 * declaration. Inert on the positioned-word/decoration subtrees, whose
 * wrappers carry no behind-actor vars (`active` resolves to 0).
 *
 * Only the export path may use this rule: in the preview the same
 * translate must ride the segment wrapper instead, because interaction
 * boxes have to move with the caption and `.segment` sits inside them.
 */
export const BEHIND_ACTOR_LIFT_CSS =
  `.segment { translate: 0 calc(var(${CssVariable.BEHIND_ACTOR_ACTIVE}, 0) * -1 * var(${TemplateCssVariable.BEHIND_ACTOR_LIFT}, 0px)); }`;
