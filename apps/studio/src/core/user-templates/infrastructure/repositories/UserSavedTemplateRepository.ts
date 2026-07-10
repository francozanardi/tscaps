import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';
import type { Template } from '@core/templates/domain/Template';
import type { UserTemplateRepository } from '@core/user-templates/domain/UserTemplateRepository';

/**
 * `TemplateRepository` view over a `UserTemplateRepository`. Projects
 * each `UserTemplate` to its embedded `Template`, so any consumer that
 * resolves templates by id (project deserialisation, the aggregate
 * repository) sees user-saved templates without knowing the user-
 * library shape.
 */
export class UserSavedTemplateRepository implements TemplateRepository {

  constructor(private readonly library: UserTemplateRepository) {}

  async getAll(): Promise<Template[]> {
    const entries = await this.library.list();
    return entries.map((entry) => entry.template);
  }

  async getById(id: string): Promise<Template | null> {
    const entries = await this.library.list();
    const match = entries.find((entry) => entry.template.metadata.id === id);
    return match?.template ?? null;
  }
}
