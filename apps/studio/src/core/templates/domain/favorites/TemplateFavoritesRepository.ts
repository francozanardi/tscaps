/**
 * Persistence contract for the user's starred templates, by id.
 * `add` and `remove` are idempotent — calling either with the same id
 * twice is a no-op — so a UI toggle can fire and forget without
 * racing the persistence layer.
 */
export interface TemplateFavoritesRepository {
  list(): Promise<readonly string[]>;
  add(templateId: string): Promise<void>;
  remove(templateId: string): Promise<void>;
}
