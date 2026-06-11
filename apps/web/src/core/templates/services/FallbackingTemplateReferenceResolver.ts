import type { Template } from '@core/templates/domain/Template';
import type { TemplateReferenceResolver } from '@core/templates/domain/TemplateReferenceResolver';
import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';
import type { TemplateSubstitutionNotifier } from '@core/templates/domain/TemplateSubstitutionNotifier';

/**
 * `TemplateReferenceResolver` that returns the first template offered
 * by the catalog whenever the requested id is unknown, and publishes
 * the substitution through `TemplateSubstitutionNotifier` so observers
 * can react (e.g. inform the user).
 *
 * Throws when the catalog is empty, since there is nothing to fall back
 * on — this is treated as an unrecoverable boot state rather than a
 * runtime concern.
 */
export class FallbackingTemplateReferenceResolver implements TemplateReferenceResolver {
  constructor(
    private readonly templates: TemplateRepository,
    private readonly substitutionNotifier: TemplateSubstitutionNotifier,
  ) {}

  async resolve(templateId: string): Promise<Template> {
    const found = await this.templates.getById(templateId);
    if (found) return found;
    const fallback = await this.pickFallback();
    this.substitutionNotifier.notifySubstitution(templateId);
    return fallback;
  }

  private async pickFallback(): Promise<Template> {
    const all = await this.templates.getAll();
    const first = all[0];
    if (!first) throw new Error('No templates available to substitute a missing reference.');
    return first;
  }
}
