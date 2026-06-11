import type { Template } from '@core/templates/domain/Template';

/**
 * Resolves a `templateId` (carried by a persisted entity such as a
 * sheet) to a live `Template` instance. Implementations encode the
 * policy that applies when the id is missing from the underlying
 * template catalog — e.g. throw, or substitute with a fallback and
 * report through a side channel.
 *
 * Consumers (notably `ProjectSerializer`) depend on this abstraction
 * rather than `TemplateRepository` so the policy lives outside the
 * serialization mechanics.
 */
export interface TemplateReferenceResolver {
  resolve(templateId: string): Promise<Template>;
}
