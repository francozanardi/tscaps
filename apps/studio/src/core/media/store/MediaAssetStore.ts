import { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { MediaAsset } from '@core/media/domain/MediaAsset';

/**
 * The assets the open project can use, as last listed, plus those added
 * since. Emits `'change'` on every write. Holds no logic of its own.
 *
 * Kept out of the editor's undo history and out of the project payload:
 * the list is the user's, not the project's, and undoing a shot must
 * never take a file with it.
 */
export class MediaAssetStore extends EventTarget {
  private catalog = MediaAssetCatalog.empty();

  snapshot(): MediaAssetCatalog {
    return this.catalog;
  }

  /** Replaces the whole list, keeping what the session holds that no listing ever names. */
  replace(listed: readonly MediaAsset[]): void {
    const sessionHeld = this.catalog.list().filter((asset) => asset.owner.kind === 'session');
    this.set(MediaAssetCatalog.of([...listed, ...sessionHeld]));
  }

  /** Adds `asset`, or replaces the one holding its id. */
  put(asset: MediaAsset): void {
    this.set(this.catalog.with(asset));
  }

  remove(assetId: string): void {
    this.set(this.catalog.without(assetId));
  }

  private set(catalog: MediaAssetCatalog): void {
    if (catalog === this.catalog) return;
    this.catalog = catalog;
    this.dispatchEvent(new Event('change'));
  }
}
