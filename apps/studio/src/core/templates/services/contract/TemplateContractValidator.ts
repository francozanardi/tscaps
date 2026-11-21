import type { CssMinifier } from '@tscaps/engine/advanced';
import type { CssContractRule } from '@core/templates/domain/contract/CssContractRule';
import type { FiltersSvgContractRule } from '@core/templates/domain/contract/FiltersSvgContractRule';
import type { TemplateJsonContractRule } from '@core/templates/domain/contract/TemplateJsonContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';
import type { TemplateContractContext } from '@core/templates/domain/contract/TemplateContractContext';

/**
 * Runs every registered contract rule over template source. Strips
 * comments once and hands the same minified CSS to each CSS rule; the
 * `filters.svg` rules receive the raw source; the `template.json`
 * rules receive the parsed value. An empty result means the source is
 * contract-clean; violations carry author-facing messages.
 */
export class TemplateContractValidator {
  constructor(
    private readonly minifier: CssMinifier,
    private readonly cssRules: ReadonlyArray<CssContractRule>,
    private readonly filtersSvgRules: ReadonlyArray<FiltersSvgContractRule>,
    private readonly templateJsonRules: ReadonlyArray<TemplateJsonContractRule>,
  ) {}

  validateCss(css: string, context: TemplateContractContext): ContractViolation[] {
    const minified = this.minifier.minify(css);
    return this.cssRules.flatMap((rule) => rule.check(minified, context));
  }

  validateFiltersSvg(source: string, context: TemplateContractContext): ContractViolation[] {
    return this.filtersSvgRules.flatMap((rule) => rule.check(source, context));
  }

  validateTemplateJson(templateJson: unknown, context: TemplateContractContext): ContractViolation[] {
    return this.templateJsonRules.flatMap((rule) => rule.check(templateJson, context));
  }
}
