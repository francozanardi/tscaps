import type { UserTemplate } from '@core/user-templates/domain/UserTemplate';

/**
 * Persistence port for the user's saved templates. CRUD over
 * `UserTemplate` entries — list, upsert by id, remove by id.
 *
 * `save` is an upsert keyed on `userTemplate.template.metadata.id`;
 * timestamps and id are caller-managed and stored as given.
 */
export interface UserTemplateRepository {
  list(): Promise<readonly UserTemplate[]>;
  save(userTemplate: UserTemplate): Promise<void>;
  delete(id: string): Promise<void>;
}
