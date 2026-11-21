import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetRepository } from '@core/media/domain/MediaAssetRepository';
import type { MediaAssetUploader } from '@core/media/domain/MediaAssetUploader';
import type { MediaAssetOriginalsPrefetcher } from '@core/media/services/MediaAssetOriginalsPrefetcher';
import type { MediaAssetPreparer } from '@core/media/services/MediaAssetPreparer';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';

interface Listing {
  readonly projectId: string | null;
  readonly assets: Promise<readonly MediaAsset[]>;
}

/** Whose listing the store holds now. */
interface ShownListing {
  readonly projectId: string | null;
}

/**
 * Lists the assets a project can use — its own and the user's
 * library, or the library alone for no project — into the store, and
 * brings them to ready.
 *
 * Resolves once the assets in `awaited` are settled; the rest are made
 * ready in the background, behind them. Their originals start coming to
 * this device too, and whatever of them the remote copy lacks and this
 * device holds starts going up.
 *
 * Only the listing asked for last writes the store: one for a project
 * the reader has already left never overwrites the one they are on.
 * Asking again for the project whose listing is under way joins it;
 * {@link refresh} never does.
 *
 * A listing that cannot be had (the list's home unreachable) keeps the
 * store as it is when it already holds that project's list, which is
 * then at worst a little behind; otherwise it empties the store rather
 * than leave another project's assets on offer. A shot naming an asset
 * not in the store reads it as missing, which every reader survives.
 */
export class LoadMediaAssetsAction {
  private joinable: Listing | null = null;
  private lastAsked = 0;
  private shown: ShownListing | null = null;

  constructor(
    private readonly repository: MediaAssetRepository,
    private readonly assets: MediaAssetStore,
    private readonly preparer: MediaAssetPreparer,
    private readonly prefetcher: MediaAssetOriginalsPrefetcher,
    private readonly uploader: MediaAssetUploader,
  ) {}

  async execute(projectId: string | null, awaited: ReadonlySet<string> = new Set()): Promise<void> {
    const listing = this.joinable?.projectId === projectId ? this.joinable : this.startListing(projectId);
    const listed = await listing.assets;
    this.prefetcher.prefetch(awaited);
    await this.preparer.ensurePrepared(listed, awaited);
  }

  /**
   * Lists `projectId` again with a fresh read, for when its list may
   * have changed where it lives. A listing already under way is not
   * joined, since it may have been read before the change.
   */
  async refresh(projectId: string | null): Promise<void> {
    const listed = await this.startListing(projectId).assets;
    await this.preparer.ensurePrepared(listed, new Set());
  }

  private startListing(projectId: string | null): Listing {
    const asked = ++this.lastAsked;
    const listing: Listing = { projectId, assets: this.list(projectId, asked) };
    this.joinable = listing;
    void listing.assets.finally(() => {
      if (this.joinable === listing) this.joinable = null;
    });
    return listing;
  }

  private async list(projectId: string | null, asked: number): Promise<readonly MediaAsset[]> {
    let listed: readonly MediaAsset[];
    try {
      listed = await this.repository.list(projectId);
    } catch (error) {
      console.error('[media] the list of media files could not be had', error);
      if (asked !== this.lastAsked) return [];
      this.keepOnlyIfShowing(projectId);
      return this.assets.snapshot().list();
    }
    if (asked !== this.lastAsked) return listed;
    this.assets.replace(listed);
    this.shown = { projectId };
    this.uploader.resume(listed);
    return this.assets.snapshot().list();
  }

  private keepOnlyIfShowing(projectId: string | null): void {
    if (this.shown !== null && this.shown.projectId === projectId) return;
    this.assets.replace([]);
    this.shown = null;
  }
}
