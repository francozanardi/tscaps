import type { CssCustomPropertyDefinitionScanner, CssVarReferenceScanner } from '@tscaps/engine';
import type { CssContractRule } from '@core/templates/domain/contract/CssContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';
import type { TemplateContractContext } from '@core/templates/domain/contract/TemplateContractContext';
import type { StyleContract } from '@core/templates/domain/contract/StyleContract';

/**
 * Flags every `var(--name)` read whose name has no writer: not in the
 * engine/editor fixed set, not a style control of the template, and
 * not defined inside the stylesheet itself.
 */
export class VariableReadsCssContractRule implements CssContractRule {
  constructor(
    private readonly contract: StyleContract,
    private readonly varReferenceScanner: CssVarReferenceScanner,
    private readonly customPropertyDefinitionScanner: CssCustomPropertyDefinitionScanner,
  ) {}

  check(minifiedCss: string, context: TemplateContractContext): ContractViolation[] {
    const allowed = this.contract.cssVariablesFor(context.styleControlIds, context.fontStackIds);
    const locallyDefined = this.customPropertyDefinitionScanner.scan(minifiedCss);
    const violations: ContractViolation[] = [];
    for (const name of this.varReferenceScanner.scan(minifiedCss)) {
      if (allowed.has(name) || locallyDefined.has(name)) continue;
      violations.push({
        message: `Unknown CSS variable "${name}": nothing writes it (not an engine/editor variable, not a style control of this template, not defined in this stylesheet), so var(${name}) always falls back.`,
      });
    }
    return violations;
  }
}
