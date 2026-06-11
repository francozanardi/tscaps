import type { Asset } from '@core/templates/domain/Asset';
import type { AssetRepository } from '@core/templates/domain/AssetRepository';

/**
 * Asset repository over the bundle-time assets. Every entry carries
 * `source: 'builtin'`. Ids are append-and-deprecate by contract:
 * persisted references to an id outlive the bytes, so a replacement
 * is registered under a fresh id rather than overwriting an existing
 * one.
 */
export class BuiltinAssetRepository implements AssetRepository {

  private readonly byId: ReadonlyMap<string, Asset>;

  constructor(entries: readonly Asset[]) {
    const byId = new Map<string, Asset>();
    for (const entry of entries) {
      if (byId.has(entry.id)) {
        throw new Error(`Duplicate builtin asset id: "${entry.id}"`);
      }
      byId.set(entry.id, entry);
    }
    this.byId = byId;
  }

  list(): readonly Asset[] {
    return Array.from(this.byId.values());
  }

  resolve(id: string): Asset | null {
    return this.byId.get(id) ?? null;
  }
}
