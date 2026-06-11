import type { TemplateLibraryStore } from '@core/templates/store/TemplateLibraryStore';
import type { TemplateUsageRepository } from '@core/templates/domain/TemplateUsageRepository';

/**
 * How many of the most-recent entries the library exposes for rendering.
 * The repository may persist more (its own retention policy); this cap
 * decides how many are observable through the store.
 */
export const RECENT_VISIBLE_COUNT = 6;

/**
 * Records that the user applied a template, persisting the change in the
 * usage repository and refreshing the observable store with the latest
 * MRU slice.
 */
export class RecordTemplateUseAction {
  constructor(
    private readonly store: TemplateLibraryStore,
    private readonly repository: TemplateUsageRepository,
  ) {}

  execute(templateId: string): void {
    this.repository.recordUse(templateId);
    this.store.setRecent(this.repository.recent().slice(0, RECENT_VISIBLE_COUNT));
  }
}
