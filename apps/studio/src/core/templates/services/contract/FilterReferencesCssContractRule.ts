import type { CssFilterReferenceScanner } from '@tscaps/engine/advanced';
import type { CssContractRule } from '@core/templates/domain/contract/CssContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';
import type { TemplateContractContext } from '@core/templates/domain/contract/TemplateContractContext';

/**
 * Flags every `url(#id)` reference that matches no `<filter>` id in
 * the template's built filters.
 */
export class FilterReferencesCssContractRule implements CssContractRule {
  constructor(private readonly referenceScanner: CssFilterReferenceScanner) {}

  check(minifiedCss: string, context: TemplateContractContext): ContractViolation[] {
    const violations: ContractViolation[] = [];
    for (const id of this.referenceScanner.scan(minifiedCss)) {
      if (context.filterIds.has(id)) continue;
      violations.push({
        message: `url(#${id}) matches no <filter> id available to this template. `
          + `Reference a ready-made filter from presets/templates/_lib/filters/ready/ or define one in filters.svg.`,
      });
    }
    return violations;
  }
}
