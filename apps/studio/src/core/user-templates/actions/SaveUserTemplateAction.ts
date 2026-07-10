import type { Sheet } from '@core/sheets/domain/Sheet';
import type { UserTemplate } from '@core/user-templates/domain/UserTemplate';
import { MAX_USER_TEMPLATES } from '@core/user-templates/domain/UserTemplate';
import { UserTemplateQuotaError } from '@core/user-templates/domain/UserTemplateQuotaError';
import type { UserTemplateRepository } from '@core/user-templates/domain/UserTemplateRepository';
import type { UserTemplateNameValidator } from '@core/user-templates/services/UserTemplateNameValidator';
import type { TemplateFromSheetBuilder } from '@core/user-templates/services/TemplateFromSheetBuilder';
import type { UserTemplatesStore } from '@core/user-templates/store/UserTemplatesStore';

export interface SaveUserTemplateInput {
  readonly name: string;
  readonly sheet: Sheet;
  readonly parentTemplateId: string | null;
}

/**
 * Snapshots a sheet's current styling as a new `UserTemplate`,
 * persists it, and pushes the new entry into the observable library
 * so the picker reflects it on the next render. Validates `name`
 * defensively — a UI that skipped validation surfaces an error
 * rather than persisting an invalid entity.
 */
export class SaveUserTemplateAction {

  constructor(
    private readonly repository: UserTemplateRepository,
    private readonly templateBuilder: TemplateFromSheetBuilder,
    private readonly store: UserTemplatesStore,
    private readonly nameValidator: UserTemplateNameValidator,
  ) {}

  async execute(input: SaveUserTemplateInput): Promise<UserTemplate> {
    const current = this.store.snapshot().length;
    if (current >= MAX_USER_TEMPLATES) {
      throw new UserTemplateQuotaError(current, MAX_USER_TEMPLATES);
    }
    const nameError = this.nameValidator.validate(input.name);
    if (nameError) throw new Error(nameError);
    const now = new Date();
    const template = this.templateBuilder.build(input.sheet, {
      id: crypto.randomUUID(),
      name: input.name,
    });
    const userTemplate: UserTemplate = {
      template,
      parentTemplateId: input.parentTemplateId,
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.save(userTemplate);
    this.store.setUserTemplates([...this.store.snapshot(), userTemplate]);
    return userTemplate;
  }
}
