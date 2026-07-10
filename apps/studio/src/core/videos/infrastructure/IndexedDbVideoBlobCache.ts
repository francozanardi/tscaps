import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { VideoBlobCache } from '@core/videos/domain/VideoBlobCache';

const STORE = 'videos';

/**
 * How many recently-opened projects keep their cached artefacts
 * (video blob, preview proxy, person-segmentation cache) resident in
 * IndexedDB before LRU eviction reclaims their space. Anchored here
 * because the video blob is the primary artefact — evicting a
 * project's other artefacts without the source blob would leave
 * orphan bytes; keeping the source without the derivatives forces a
 * re-scan on re-open, which is the exact experience the caps aim to
 * prevent.
 */
export const MAX_CACHED_PROJECT_ARTIFACTS = 3;

interface VideoRecord {
  readonly projectId: string;
  readonly blob: Blob;
  lastAccessed: number;
}

/**
 * `VideoBlobCache` backed by the shared `videos` IndexedDB store.
 * Caps the number of entries via LRU eviction by `lastAccessed`; the
 * cap is tuned so the most recent few projects re-open instantly
 * without prompting a re-select or a re-download, without growing
 * IndexedDB without bound for users with many projects.
 */
export class IndexedDbVideoBlobCache implements VideoBlobCache {
  constructor(private readonly db: IndexedDbClient) {}

  async load(projectId: string): Promise<Blob | null> {
    const record = await this.db.readOne<VideoRecord>(STORE, projectId);
    if (!record) return null;
    await this.touch(record);
    return record.blob;
  }

  async store(projectId: string, blob: Blob): Promise<void> {
    await this.evictIfNeeded(projectId);
    const record: VideoRecord = {
      projectId,
      blob,
      lastAccessed: Date.now(),
    };
    await this.db.writeOne(STORE, record);
  }

  async delete(projectId: string): Promise<void> {
    await this.db.deleteOne(STORE, projectId);
  }

  private async touch(record: VideoRecord): Promise<void> {
    record.lastAccessed = Date.now();
    await this.db.writeOne(STORE, record);
  }

  /**
   * Evicts the least-recently-accessed entry if adding `incomingId`
   * would push the cache over the cap. Replacing the entry that
   * already lives at `incomingId` is not growth, so refreshing a
   * project's cached blob never evicts another project's blob.
   */
  private async evictIfNeeded(incomingId: string): Promise<void> {
    const all = await this.db.readAll<VideoRecord>(STORE);
    const isReplacement = all.some((r) => r.projectId === incomingId);
    const projectedSize = isReplacement ? all.length : all.length + 1;
    if (projectedSize <= MAX_CACHED_PROJECT_ARTIFACTS) return;
    const victim = this.pickEvictionVictim(all, incomingId);
    if (victim) await this.delete(victim.projectId);
  }

  private pickEvictionVictim(all: VideoRecord[], incomingId: string): VideoRecord | null {
    const candidates = all
      .filter((r) => r.projectId !== incomingId)
      .sort((a, b) => a.lastAccessed - b.lastAccessed);
    return candidates[0] ?? null;
  }
}
