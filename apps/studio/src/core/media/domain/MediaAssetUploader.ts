import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetRendition } from '@core/media/domain/MediaAssetRendition';
import type { MediaAssetUploadStatus } from '@core/media/domain/MediaAssetUploadStatus';

/**
 * Keeps the user's remote copy of their assets in step with this
 * device, in the background: sends each rendition from the moment it
 * exists, never waiting for a save, and takes a deleted asset off it.
 * An asset is usable in the editor all along; its bytes are here.
 *
 * Where there is no remote copy there is nothing to send, and no asset
 * ever has a status.
 */
export interface MediaAssetUploader {
  /** Queues `rendition` of `asset` to go up. */
  enqueue(asset: MediaAsset, rendition: MediaAssetRendition): void;
  /** Queues whatever of these assets the remote copy lacks and this device holds. */
  resume(assets: readonly MediaAsset[]): void;
  /** Tries again every rendition of `assetId` whose last attempt failed. */
  retry(assetId: string): void;
  /** `asset` changed owner; whatever of it is still waiting goes up under the new one. */
  moved(asset: MediaAsset): void;
  /**
   * Stops sending `assetId` and has it taken off the remote copy, after
   * whatever of it is going up right now has finished. Resolves once
   * the removal is recorded durably — it survives a reload and is
   * retried until the remote copy confirms it.
   */
  remove(assetId: string): Promise<void>;
  /** Where `rendition` of `assetId` stands, or null when never queued. The same object until it changes. */
  statusOf(assetId: string, rendition: MediaAssetRendition): MediaAssetUploadStatus | null;
  /** Whether a file is still waiting or going up. */
  hasUploadsInFlight(): boolean;
  /** Calls `listener` on every change of any asset's status. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}
