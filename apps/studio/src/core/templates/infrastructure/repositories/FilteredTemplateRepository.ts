import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';
import type { Template } from '@core/templates/domain/Template';

/**
 * `TemplateRepository` decorator that restricts `getAll()` to a
 * provided allow-list of template ids and leaves `getById(id)`
 * untouched. The allow-list is captured at construction; the
 * underlying repository is the source of identity and ordering.
 *
 * `getById` is intentionally not filtered so an already-persisted
 * reference to an id outside the allow-list can still be resolved
 * and inspected.
 */
export class FilteredTemplateRepository implements TemplateRepository {

  constructor(
    private readonly inner: TemplateRepository,
    private readonly allowedIds: ReadonlySet<string>,
  ) {}

  async getAll(): Promise<Template[]> {
    const all = await this.inner.getAll();
    return all.filter((template) => this.allowedIds.has(template.metadata.id));
  }

  getById(id: string): Promise<Template | null> {
    return this.inner.getById(id);
  }
}
