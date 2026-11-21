import type { CssKeyframesScanner } from '@tscaps/engine/advanced';
import type { CssContractRule } from '@core/templates/domain/contract/CssContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';

/**
 * Flags every `animation` / `animation-name` reference that resolves
 * to no `@keyframes` defined in the same stylesheet.
 */
export class AnimationReferencesCssContractRule implements CssContractRule {
  constructor(private readonly keyframesScanner: CssKeyframesScanner) {}

  check(minifiedCss: string): ContractViolation[] {
    const defined = this.keyframesScanner.definedNames(minifiedCss);
    const violations: ContractViolation[] = [];
    for (const name of this.keyframesScanner.referencedNames(minifiedCss)) {
      if (defined.has(name)) continue;
      violations.push({
        message: `Animation references "@keyframes ${name}", which this stylesheet does not define.`,
      });
    }
    return violations;
  }
}
