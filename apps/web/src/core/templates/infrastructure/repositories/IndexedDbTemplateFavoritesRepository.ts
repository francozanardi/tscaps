import type { IndexedDbClient } from '@core/_shared/persistence/IndexedDbClient';
import type { TemplateFavoritesRepository } from '@core/templates/domain/TemplateFavoritesRepository';

const STORE = 'template-favorites';

interface PersistedTemplateFavoriteRecord {
  readonly id: string;
  readonly createdAt: number;
}

/**
 * Browser-side `TemplateFavoritesRepository` backed by the shared
 * IndexedDB connection. One record per starred template, keyed by the
 * template id; `add` and `remove` map onto idempotent `put` / `delete`
 * calls and the listing is ordered most recently starred first.
 */
export class IndexedDbTemplateFavoritesRepository implements TemplateFavoritesRepository {

  constructor(private readonly db: IndexedDbClient) {}

  async list(): Promise<readonly string[]> {
    const records = await this.db.readAll<PersistedTemplateFavoriteRecord>(STORE);
    return records
      .filter((record) => typeof record?.id === 'string')
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((record) => record.id);
  }

  add(templateId: string): Promise<void> {
    const record: PersistedTemplateFavoriteRecord = {
      id: templateId,
      createdAt: Date.now(),
    };
    return this.db.writeOne(STORE, record);
  }

  remove(templateId: string): Promise<void> {
    return this.db.deleteOne(STORE, templateId);
  }
}
