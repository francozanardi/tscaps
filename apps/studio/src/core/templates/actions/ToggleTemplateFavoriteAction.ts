import type { TemplateLibraryStore } from '@core/templates/store/TemplateLibraryStore';
import type { TemplateFavoritesRepository } from '@core/templates/domain/favorites/TemplateFavoritesRepository';

/**
 * Toggles a template's starred state. Decides add/remove against the
 * current store snapshot, updates the store optimistically so the UI
 * reflects the change instantly, and persists in the background. A
 * persistence failure rolls the store back to the previous set and
 * rethrows so the caller can surface the error.
 */
export class ToggleTemplateFavoriteAction {
  constructor(
    private readonly store: TemplateLibraryStore,
    private readonly repository: TemplateFavoritesRepository,
  ) {}

  async execute(templateId: string): Promise<void> {
    const previous = this.store.snapshot().favorites;
    const next = this.toggle(previous, templateId);
    this.store.setFavorites(next);
    try {
      await this.persistChange(previous, templateId);
    } catch (err) {
      this.store.setFavorites(previous);
      throw err;
    }
  }

  private toggle(current: ReadonlySet<string>, templateId: string): ReadonlySet<string> {
    const next = new Set(current);
    if (next.has(templateId)) next.delete(templateId);
    else next.add(templateId);
    return next;
  }

  private persistChange(previous: ReadonlySet<string>, templateId: string): Promise<void> {
    return previous.has(templateId)
      ? this.repository.remove(templateId)
      : this.repository.add(templateId);
  }
}
