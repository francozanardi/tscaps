/**
 * MRU-ordered store of templates the user has applied. `recordUse`
 * dedupes — re-applying a template promotes the existing entry.
 */
export interface TemplateUsageRepository {
  recent(): readonly string[];
  recordUse(templateId: string): void;
}
