import type { CssKeyframesScanner } from '@tscaps/engine/advanced';
import type { CssContractRule } from '@core/templates/domain/contract/CssContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';
import type { TemplateContractContext } from '@core/templates/domain/contract/TemplateContractContext';

/**
 * Flags every animation a stylesheet applies without declaring it.
 *
 * An undeclared animation is not a broken template — it renders — and
 * that is what makes it worth catching here. The editor reads the
 * record to say what a template does to each kind of element, so an
 * animation missing from it comes out as "None": a panel stating the
 * captions hold still, over captions that move. Nothing downstream can
 * tell that apart from a template that genuinely animates nothing.
 *
 * Matched on the `@keyframes` names each declaration claims rather
 * than on the animation's id, so a template is free to name its
 * animation one thing and its blocks another, and an animation made of
 * two blocks says so.
 *
 * Stands down when the record is absent — a template loaded for
 * editing carries no build-time registry, and a rule that reported
 * everything as undeclared there would be noise.
 */
export class DeclaredAnimationsCssContractRule implements CssContractRule {
  constructor(private readonly keyframesScanner: CssKeyframesScanner) {}

  check(minifiedCss: string, context: TemplateContractContext): ContractViolation[] {
    const declared = context.declaredAnimationKeyframes;
    if (declared === undefined) return [];
    const violations: ContractViolation[] = [];
    for (const name of this.keyframesScanner.referencedNames(minifiedCss)) {
      if (declared.has(name)) continue;
      violations.push({
        message: `Animation "@keyframes ${name}" is applied but never declared. `
          + `Add \`@include declared.animation('<id>', '<element>')\` to the rule that applies it, `
          + `naming the element it lands on — otherwise the editor reads this kind as not moving at all.`,
      });
    }
    return violations;
  }
}
