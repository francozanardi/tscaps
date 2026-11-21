import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetOwner } from '@core/media/domain/MediaAssetOwner';

/**
 * Where what is known about each asset is kept — the list of a user's
 * files, not their bytes. An asset held for the session alone is never
 * here.
 */
export interface MediaAssetRepository {
  /**
   * The assets a project can use: the ones it owns and every one in
   * the library; the library alone when `projectId` is null. Rejects
   * when the list cannot be had, which is not the same as an empty one.
   */
  list(projectId: string | null): Promise<readonly MediaAsset[]>;
  /** Records an asset just added. Rejects when it could not be kept. */
  add(asset: MediaAsset): Promise<void>;
  /** Gives the asset to `owner`. Rejects when the move was refused or did not reach where the list lives. */
  move(asset: MediaAsset, owner: MediaAssetOwner): Promise<void>;
  /** Forgets the asset. Resolves whether or not it was held. */
  delete(assetId: string): Promise<void>;
}
