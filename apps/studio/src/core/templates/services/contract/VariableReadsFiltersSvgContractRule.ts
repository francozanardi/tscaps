import type { CssVarReferenceScanner } from '@tscaps/engine/advanced';
import type { FiltersSvgContractRule } from '@core/templates/domain/contract/FiltersSvgContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';
import type { TemplateContractContext } from '@core/templates/domain/contract/TemplateContractContext';
import type { StyleContract } from '@core/templates/domain/contract/StyleContract';

/**
 * Flags every `var(--name)` placeholder in filter bodies whose name
 * nothing writes into the filter scope: not the engine/editor set,
 * not a style control of the template, not a runtime filter helper.
 */
export class VariableReadsFiltersSvgContractRule implements FiltersSvgContractRule {
  constructor(
    private readonly contract: StyleContract,
    private readonly varReferenceScanner: CssVarReferenceScanner,
  ) {}

  check(source: string, context: TemplateContractContext): ContractViolation[] {
    const allowed = this.contract.filtersSvgVariablesFor(context.styleControlIds);
    const violations: ContractViolation[] = [];
    for (const name of this.varReferenceScanner.scan(source)) {
      if (allowed.has(name)) continue;
      violations.push({
        message: `Unknown CSS variable "${name}": nothing writes it into the filter scope (not an engine/editor variable, not a style control of this template, not a runtime filter helper).`,
      });
    }
    return violations;
  }
}
