import type { RenderItem, UniqueTile, AssetGroup } from '@modules/rendering/subtitle/BatchPlan';

/**
 * Builds one asset group: tracks the unique tiles accumulated for an
 * asset key, deduplicates new arrivals by state key, and finalizes
 * into an {@link AssetGroup}.
 */
export class AssetGroupBuilder {
  private readonly tiles: UniqueTile[] = [];
  private readonly tileByStateKey = new Map<string, UniqueTile>();

  constructor(readonly assetKey: string) {}

  upsertTile(stateKey: string, items: RenderItem[]): UniqueTile {
    let tile = this.tileByStateKey.get(stateKey);
    if (!tile) {
      tile = { items, tileIndex: this.tiles.length };
      this.tiles.push(tile);
      this.tileByStateKey.set(stateKey, tile);
    }
    return tile;
  }

  build(): AssetGroup {
    return { assetKey: this.assetKey, uniqueTiles: this.tiles };
  }
}
