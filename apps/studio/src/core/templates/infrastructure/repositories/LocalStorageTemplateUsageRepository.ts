import type { LocalStorageClient } from '@core/_shared/infrastructure/LocalStorageClient';
import type { TemplateUsageRepository } from '@core/templates/domain/favorites/TemplateUsageRepository';

const KEY = 'template-recent';

/**
 * Persisted bigger than the picker shows (controller caps lower) so
 * removing a stale entry doesn't immediately empty the recents tab.
 */
const MAX_ENTRIES = 12;

/** localStorage-backed recently-used store. */
export class LocalStorageTemplateUsageRepository implements TemplateUsageRepository {

  constructor(private readonly storage: LocalStorageClient) {}

  recent(): readonly string[] {
    const raw = this.storage.get<string[]>(KEY);
    if (!Array.isArray(raw)) return [];
    return raw.filter((id): id is string => typeof id === 'string');
  }

  recordUse(templateId: string): void {
    const current = this.recent();
    const without = current.filter((id) => id !== templateId);
    const next = [templateId, ...without].slice(0, MAX_ENTRIES);
    this.storage.set(KEY, next);
  }
}
