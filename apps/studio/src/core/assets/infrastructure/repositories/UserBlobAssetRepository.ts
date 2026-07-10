import type { Asset } from '@core/assets/domain/Asset';
import type { AssetRepository } from '@core/assets/domain/AssetRepository';
import type { UserBlobUrlResolver } from '@core/user-blobs/services/UserBlobUrlResolver';
import type { UserBlobsStore } from '@core/user-blobs/store/UserBlobsStore';

/**
 * Asset repository over the user-uploaded blobs of kind
 * `template-asset`. A read-only projection over the user-blobs feature:
 * the store owns the observable list and the url-resolver owns the
 * object-URL lifecycle. This repository neither fetches nor caches —
 * every call reads the latest in-memory snapshot.
 *
 * Entries with no resolvable URL (a blob that exists in the store but
 * whose object URL has been revoked, in practice a transient state
 * during rehydration) are skipped from `list()` and resolve as `null`.
 */
export class UserBlobAssetRepository implements AssetRepository {

  constructor(
    private readonly store: UserBlobsStore,
    private readonly urlResolver: UserBlobUrlResolver,
  ) {}

  list(): readonly Asset[] {
    const assets: Asset[] = [];
    for (const blob of this.store.snapshot()) {
      if (blob.kind !== 'template-asset') continue;
      const url = this.urlResolver.resolve(blob.id);
      if (url === null) continue;
      assets.push({ id: blob.id, url, source: 'user' });
    }
    return assets;
  }

  resolve(id: string): Asset | null {
    const blob = this.store.snapshot().find((b) => b.id === id);
    if (!blob || blob.kind !== 'template-asset') return null;
    const url = this.urlResolver.resolve(id);
    if (url === null) return null;
    return { id, url, source: 'user' };
  }
}
