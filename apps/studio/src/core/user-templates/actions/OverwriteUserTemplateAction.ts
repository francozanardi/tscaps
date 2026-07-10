import type { Sheet } from '@core/sheets/domain/Sheet';
import type { UserTemplate } from '@core/user-templates/domain/UserTemplate';
import type { UserTemplateRepository } from '@core/user-templates/domain/UserTemplateRepository';
import type { TemplateFromSheetBuilder } from '@core/user-templates/services/TemplateFromSheetBuilder';
import type { UserTemplatesStore } from '@core/user-templates/store/UserTemplatesStore';

/**
 * Re-snapshots `sheet`'s current styling into the saved template
 * identified by `id`, preserving `template.metadata.id`, `name`,
 * `createdAt` and `parentTemplateId`; `updatedAt` is bumped. Other
 * sheets that already reference the same id keep their existing
 * resolved template until they reload — this is intentional.
 * Throws when the id is unknown.
 */
export class OverwriteUserTemplateAction {

  constructor(
    private readonly repository: UserTemplateRepository,
    private readonly templateBuilder: TemplateFromSheetBuilder,
    private readonly store: UserTemplatesStore,
  ) {}

  async execute(id: string, sheet: Sheet): Promise<UserTemplate> {
    const current = this.findEntry(id);
    const overwritten: UserTemplate = {
      template: this.templateBuilder.build(sheet, {
        id: current.template.metadata.id,
        name: current.template.metadata.name,
      }),
      parentTemplateId: current.parentTemplateId,
      createdAt: current.createdAt,
      updatedAt: new Date(),
    };
    await this.repository.save(overwritten);
    this.store.setUserTemplates(this.replaceInSnapshot(id, overwritten));
    return overwritten;
  }

  private findEntry(id: string): UserTemplate {
    const match = this.store.snapshot().find((entry) => entry.template.metadata.id === id);
    if (!match) throw new Error(`No saved template with id ${id}.`);
    return match;
  }

  private replaceInSnapshot(id: string, replacement: UserTemplate): UserTemplate[] {
    return this.store.snapshot().map(
      (entry) => entry.template.metadata.id === id ? replacement : entry,
    );
  }
}
