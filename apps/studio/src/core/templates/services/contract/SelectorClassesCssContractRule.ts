import type { CssSelectorClassScanner } from '@tscaps/engine/advanced';
import type { CssContractRule } from '@core/templates/domain/contract/CssContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';
import type { StyleContract } from '@core/templates/domain/contract/StyleContract';

/**
 * Flags every selector class the renderer never emits — such a rule
 * can never match any rendered element.
 */
export class SelectorClassesCssContractRule implements CssContractRule {
  constructor(
    private readonly contract: StyleContract,
    private readonly selectorClassScanner: CssSelectorClassScanner,
  ) {}

  check(minifiedCss: string): ContractViolation[] {
    const known = this.contract.rendererEmittedClasses();
    const violations: ContractViolation[] = [];
    for (const name of this.selectorClassScanner.scan(minifiedCss)) {
      if (known.has(name)) continue;
      violations.push({
        message: `Selector uses ".${name}", a class the renderer never emits, so the rule can never match.`,
      });
    }
    return violations;
  }
}
