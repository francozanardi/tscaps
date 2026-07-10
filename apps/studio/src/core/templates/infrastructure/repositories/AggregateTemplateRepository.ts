import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';
import type { Template } from '@core/templates/domain/Template';

/**
 * `TemplateRepository` that composes several sources. `getAll`
 * concatenates results in source order; `getById` returns the first
 * match by querying sources in order and stops at the first hit.
 * Sources are queried fresh on every call so reads always reflect
 * whatever the underlying repositories currently expose.
 */
export class AggregateTemplateRepository implements TemplateRepository {

  constructor(private readonly sources: readonly TemplateRepository[]) {}

  async getAll(): Promise<Template[]> {
    const results = await Promise.all(this.sources.map((source) => source.getAll()));
    return results.flat();
  }

  async getById(id: string): Promise<Template | null> {
    for (const source of this.sources) {
      const match = await source.getById(id);
      if (match !== null) return match;
    }
    return null;
  }
}
