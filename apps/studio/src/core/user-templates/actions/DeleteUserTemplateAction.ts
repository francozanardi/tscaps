import type { UserTemplateRepository } from '@core/user-templates/domain/UserTemplateRepository';
import type { UserTemplatesStore } from '@core/user-templates/store/UserTemplatesStore';

/**
 * Removes a saved user template from storage and from the observable
 * library. Sheets currently using the deleted template are not
 * touched here — the editor reverts them as the user picks a fallback
 * from the picker.
 */
export class DeleteUserTemplateAction {

  constructor(
    private readonly repository: UserTemplateRepository,
    private readonly store: UserTemplatesStore,
  ) {}

  async execute(id: string): Promise<void> {
    await this.repository.delete(id);
    this.store.setUserTemplates(
      this.store.snapshot().filter((ut) => ut.template.metadata.id !== id),
    );
  }
}
