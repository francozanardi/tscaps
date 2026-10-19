import type { TemplateJsonContractRule } from '@core/templates/domain/contract/TemplateJsonContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';

/**
 * Checks that a template says in words what it looks like. The
 * description is the only thing a reader who cannot see the gallery has
 * to choose by — a model picking a style, a program listing them — so a
 * template without one is offered by name alone.
 */
export class DescriptionTemplateJsonContractRule implements TemplateJsonContractRule {

  check(templateJson: unknown): ContractViolation[] {
    const declared = this.descriptionOf(templateJson);
    if (typeof declared === 'string' && declared.trim() !== '') return [];
    return [{
      message: 'Declares no "description". Say in a sentence or two what the captions look like and what they suit.',
    }];
  }

  private descriptionOf(templateJson: unknown): unknown {
    if (templateJson === null || typeof templateJson !== 'object') return undefined;
    return (templateJson as Record<string, unknown>)['description'];
  }
}
