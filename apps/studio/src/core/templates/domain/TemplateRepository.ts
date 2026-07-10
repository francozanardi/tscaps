import type { Template } from '@core/templates/domain/Template';

/**
 * Provides templates to consumers (the editor, the project serializer).
 */
export interface TemplateRepository {
  getAll(): Promise<Template[]>;
  getById(id: string): Promise<Template | null>;
}
