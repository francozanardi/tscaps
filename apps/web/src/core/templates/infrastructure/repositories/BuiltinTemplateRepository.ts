import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';
import type { Template } from '@core/templates/domain/Template';

export class BuiltinTemplateRepository implements TemplateRepository {
  constructor(private readonly templates: Template[]) {}

  async getAll(): Promise<Template[]> {
    return this.templates;
  }

  async getById(id: string): Promise<Template | null> {
    return this.templates.find((t) => t.metadata.id === id) ?? null;
  }
}
