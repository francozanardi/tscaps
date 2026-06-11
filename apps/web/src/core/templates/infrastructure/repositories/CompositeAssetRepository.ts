import type { Asset } from '@core/templates/domain/Asset';
import type { AssetRepository } from '@core/templates/domain/AssetRepository';

/**
 * Fan-in over several asset repositories, exposing their union as a
 * single repository. `list()` concatenates in source order; `resolve()`
 * returns the first match across sources. Ids are expected to be
 * globally unique across the underlying sources — duplicate ids
 * discovered on `list()` raise an error so authoring mistakes surface
 * loudly instead of one side silently winning.
 */
export class CompositeAssetRepository implements AssetRepository {

  constructor(private readonly sources: readonly AssetRepository[]) {}

  list(): readonly Asset[] {
    const seenIds = new Set<string>();
    const merged: Asset[] = [];
    for (const source of this.sources) {
      for (const asset of source.list()) {
        if (seenIds.has(asset.id)) {
          throw new Error(`Duplicate asset id across sources: "${asset.id}"`);
        }
        seenIds.add(asset.id);
        merged.push(asset);
      }
    }
    return merged;
  }

  resolve(id: string): Asset | null {
    for (const source of this.sources) {
      const asset = source.resolve(id);
      if (asset !== null) return asset;
    }
    return null;
  }
}
