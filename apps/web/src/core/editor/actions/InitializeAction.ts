import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { Sheet } from '@core/sheets/domain/Sheet';

/**
 * Loads the available templates and creates the initial `main` Sheet using
 * the first one. Runs once at startup.
 */
export class InitializeAction {
  constructor(
    private readonly store: EditorStore,
    private readonly templateRepository: TemplateRepository,
  ) {}

  async execute(): Promise<void> {
    const availableTemplates = await this.templateRepository.getAll();
    const first = availableTemplates[0];
    if (!first) {
      this.store.patch({ availableTemplates });
      return;
    }

    const main = Sheet.createMain(first);
    this.store.patch({
      availableTemplates,
      sheets: [main],
      activeSheetId: main.id,
    });
  }
}
