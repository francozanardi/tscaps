import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetOwner } from '@core/media/domain/MediaAssetOwner';
import type { MediaAssetRendition } from '@core/media/domain/MediaAssetRendition';

/**
 * Where the bytes of each asset are kept, by asset id and rendition.
 * The owner decides how long they live on this device: a project's go
 * with its video, the library's stay until deleted, the session's are
 * held for the page.
 */
export interface MediaAssetBytesRepository {
  /** The bytes of `rendition` of `assetId`, or null when none can be had or they can no longer be read. */
  load(assetId: string, rendition: MediaAssetRendition): Promise<Blob | null>;
  /** Keeps `blob` as `rendition` of `asset`. Rejects when the bytes could not be kept durably. */
  store(asset: Pick<MediaAsset, 'id' | 'owner'>, rendition: MediaAssetRendition, blob: Blob): Promise<void>;
  /**
   * Makes whatever is kept of `assetId` live as long as `owner` says
   * from now on — bytes held for the page alone included, which are
   * kept durably once the owner is not the session. Rejects when those
   * could not be.
   */
  reassign(assetId: string, owner: MediaAssetOwner): Promise<void>;
  /** Drops every rendition of `assetId`. */
  delete(assetId: string): Promise<void>;
}
