import type { UserTemplateRepository } from '@core/user-templates/domain/UserTemplateRepository';
import type { UserTemplatesStore } from '@core/user-templates/store/UserTemplatesStore';

/**
 * Populates the observable user-templates library from persistence
 * once at app start.
 */
export class UserTemplateLibraryHydrator {
  constructor(
    private readonly repository: UserTemplateRepository,
    private readonly store: UserTemplatesStore,
  ) {}

  async boot(): Promise<void> {
    const templates = await this.repository.list();
    this.store.setUserTemplates(templates);
  }
}
