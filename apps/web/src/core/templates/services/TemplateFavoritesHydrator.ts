import type { TemplateLibraryStore } from '@core/templates/store/TemplateLibraryStore';
import type { TemplateFavoritesRepository } from '@core/templates/domain/favorites/TemplateFavoritesRepository';

/**
 * Populates the observable templates library's favorites set from
 * persistence once at app start.
 */
export class TemplateFavoritesHydrator {
  constructor(
    private readonly repository: TemplateFavoritesRepository,
    private readonly store: TemplateLibraryStore,
  ) {}

  async boot(): Promise<void> {
    const favorites = await this.repository.list();
    this.store.setFavorites(new Set(favorites));
  }
}
