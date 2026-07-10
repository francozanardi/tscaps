import type { UserBlob } from '@core/user-blobs/domain/UserBlob';
import type {
  UserBlobPutInput,
  UserBlobRepository,
} from '@core/user-blobs/domain/UserBlobRepository';
import type { UserBlobsStore } from '@core/user-blobs/store/UserBlobsStore';

/**
 * Single source of truth for "given a stored blob id, what runtime URL
 * does the browser load?". Owns one object URL per blob and revokes
 * it on removal so the resolver also acts as the lifecycle owner; no
 * other module should call `URL.createObjectURL` against a persisted
 * blob.
 *
 * `boot()` hydrates the cache from the repository at app start;
 * `rehydrate()` swaps the cache when the active backing store
 * changes so the editor sees the blobs of whichever store owns the
 * project being edited. Every change is mirrored into
 * `UserBlobsStore` so React consumers stay in sync.
 */
export class UserBlobUrlResolver {
  private readonly urlsByBlobId = new Map<string, string>();
  private readonly blobsById = new Map<string, UserBlob>();

  constructor(
    private readonly repository: UserBlobRepository,
    private readonly store: UserBlobsStore,
  ) {}

  async boot(): Promise<void> {
    await this.loadAllFromRepository();
  }

  /**
   * Drops every cached object URL and reloads the cache from the
   * current repository, so resolution reflects the new universe of
   * blobs without restarting the editor.
   */
  async rehydrate(): Promise<void> {
    this.revokeAllObjectUrls();
    await this.loadAllFromRepository();
  }

  /** Resolved object URL for `blobId`, or `null` when no such blob exists. */
  resolve(blobId: string): string | null {
    return this.urlsByBlobId.get(blobId) ?? null;
  }

  /**
   * Persists `input` through the repository, warms the URL cache,
   * publishes the new list to the store, and returns the stored
   * record. The discriminated input carries per-kind metadata so
   * font uploads round-trip with their family / format.
   */
  async add(input: UserBlobPutInput): Promise<UserBlob> {
    const stored = await this.repository.put(input);
    this.cacheObjectUrl(stored);
    this.blobsById.set(stored.id, stored);
    this.publishStore();
    return stored;
  }

  async remove(blobId: string): Promise<void> {
    await this.repository.delete(blobId);
    this.revokeObjectUrl(blobId);
    this.blobsById.delete(blobId);
    this.publishStore();
  }

  private async loadAllFromRepository(): Promise<void> {
    this.blobsById.clear();
    const blobs = await this.repository.list();
    for (const blob of blobs) {
      this.cacheObjectUrl(blob);
      this.blobsById.set(blob.id, blob);
    }
    this.publishStore();
  }

  private cacheObjectUrl(blob: UserBlob): void {
    this.revokeObjectUrl(blob.id);
    this.urlsByBlobId.set(blob.id, URL.createObjectURL(blob.blob));
  }

  private revokeObjectUrl(blobId: string): void {
    const url = this.urlsByBlobId.get(blobId);
    if (url === undefined) return;
    URL.revokeObjectURL(url);
    this.urlsByBlobId.delete(blobId);
  }

  private revokeAllObjectUrls(): void {
    for (const url of this.urlsByBlobId.values()) URL.revokeObjectURL(url);
    this.urlsByBlobId.clear();
  }

  private publishStore(): void {
    this.store.setBlobs([...this.blobsById.values()]);
  }
}
