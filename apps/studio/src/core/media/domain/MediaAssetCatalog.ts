import type { MediaAsset } from '@core/media/domain/MediaAsset';

/**
 * The assets the open project can use — its own and the user's
 * library — by id, in the order they were added. Immutable; every
 * change returns a new instance.
 *
 * A shot may name an id this does not hold: an asset deleted on
 * another device, or one whose listing could not be had. Readers treat
 * that as a file that is missing, never as an error.
 */
export class MediaAssetCatalog {
  static empty(): MediaAssetCatalog {
    return new MediaAssetCatalog(new Map());
  }

  static of(assets: Iterable<MediaAsset>): MediaAssetCatalog {
    const byId = new Map<string, MediaAsset>();
    for (const asset of assets) if (!byId.has(asset.id)) byId.set(asset.id, asset);
    return new MediaAssetCatalog(byId);
  }

  private constructor(private readonly byId: ReadonlyMap<string, MediaAsset>) {}

  get(id: string): MediaAsset | null {
    return this.byId.get(id) ?? null;
  }

  list(): readonly MediaAsset[] {
    return [...this.byId.values()];
  }

  isEmpty(): boolean {
    return this.byId.size === 0;
  }

  /** Adds `asset`, or replaces the one holding its id in place. */
  with(asset: MediaAsset): MediaAssetCatalog {
    const next = new Map(this.byId);
    next.set(asset.id, asset);
    return new MediaAssetCatalog(next);
  }

  /** Drops the asset holding `id`, if any. */
  without(id: string): MediaAssetCatalog {
    if (!this.byId.has(id)) return this;
    const next = new Map(this.byId);
    next.delete(id);
    return new MediaAssetCatalog(next);
  }
}
