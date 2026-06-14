import { Template } from '@core/templates/domain/Template';
import type { UserTemplate } from '@core/user-templates/domain/UserTemplate';
import type { UserTemplateRepository } from '@core/user-templates/domain/UserTemplateRepository';
import type { UserTemplateNameValidator } from '@core/user-templates/services/UserTemplateNameValidator';
import type { UserTemplatesStore } from '@core/user-templates/store/UserTemplatesStore';

/**
 * Changes a saved template's display name while keeping its identity
 * stable: `template.metadata.id`, `createdAt` and `parentTemplateId`
 * are preserved; `updatedAt` is bumped. Throws when the name fails
 * validation or the id is unknown.
 */
export class RenameUserTemplateAction {

  constructor(
    private readonly repository: UserTemplateRepository,
    private readonly store: UserTemplatesStore,
    private readonly nameValidator: UserTemplateNameValidator,
  ) {}

  async execute(id: string, newName: string): Promise<UserTemplate> {
    const nameError = this.nameValidator.validate(newName);
    if (nameError) throw new Error(nameError);
    const current = this.findEntry(id);
    const renamed: UserTemplate = {
      template: this.cloneWithName(current.template, newName),
      parentTemplateId: current.parentTemplateId,
      createdAt: current.createdAt,
      updatedAt: new Date(),
    };
    await this.repository.save(renamed);
    this.store.setUserTemplates(this.replaceInSnapshot(id, renamed));
    return renamed;
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

  private cloneWithName(original: Template, newName: string): Template {
    return new Template(
      { ...original.metadata, name: newName },
      original.typography,
      original.rotation,
      original.alignment,
      original.rendering,
      original.features,
      original.effectConfigs,
      original.segmentSplitterConfigs,
      original.lineSplitter,
      original.styleControls,
      original.svgFilterDefinitions,
      original.getCss(),
      original.getFiltersSvg(),
    );
  }
}
