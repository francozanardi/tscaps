import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';
import { MAX_CACHED_PROJECT_ARTIFACTS } from '@core/videos/infrastructure/IndexedDbVideoBlobCache';

const STORE = 'video-proxies';

interface ProxyRecord {
  readonly projectId: string;
  readonly blob: Blob;
  readonly mimeType: string;
  readonly widthPx: number;
  readonly heightPx: number;
  lastAccessed: number;
}

/**
 * `PreviewProxyRepository` backed by the shared `video-proxies`
 * IndexedDB store. Caps the number of entries via LRU eviction by
 * `lastAccessed`; the cap is anchored to
 * `MAX_CACHED_PROJECT_ARTIFACTS` so the most recently opened projects
 * keep every artefact (source blob, proxy, mask cache) resident in
 * lockstep.
 */
export class IndexedDbPreviewProxyRepository implements PreviewProxyRepository {
  constructor(private readonly db: IndexedDbClient) {}

  async load(projectId: string): Promise<PreviewProxy | null> {
    const record = await this.db.readOne<ProxyRecord>(STORE, projectId);
    if (!record) return null;
    await this.touch(record);
    return this.toProxy(record);
  }

  async store(projectId: string, proxy: PreviewProxy): Promise<void> {
    await this.evictIfNeeded(projectId);
    const record: ProxyRecord = {
      projectId,
      blob: proxy.blob,
      mimeType: proxy.mimeType,
      widthPx: proxy.widthPx,
      heightPx: proxy.heightPx,
      lastAccessed: Date.now(),
    };
    await this.db.writeOne(STORE, record);
  }

  async delete(projectId: string): Promise<void> {
    await this.db.deleteOne(STORE, projectId);
  }

  private toProxy(record: ProxyRecord): PreviewProxy {
    return {
      blob: record.blob,
      mimeType: record.mimeType,
      widthPx: record.widthPx,
      heightPx: record.heightPx,
    };
  }

  private async touch(record: ProxyRecord): Promise<void> {
    record.lastAccessed = Date.now();
    await this.db.writeOne(STORE, record);
  }

  /**
   * Evicts the least-recently-accessed entry if adding `incomingId`
   * would push the cache over the cap. Replacing the entry that
   * already lives at `incomingId` is not growth, so refreshing a
   * project's cached proxy never evicts another project's proxy.
   */
  private async evictIfNeeded(incomingId: string): Promise<void> {
    const all = await this.db.readAll<ProxyRecord>(STORE);
    const isReplacement = all.some((r) => r.projectId === incomingId);
    const projectedSize = isReplacement ? all.length : all.length + 1;
    if (projectedSize <= MAX_CACHED_PROJECT_ARTIFACTS) return;
    const victim = this.pickEvictionVictim(all, incomingId);
    if (victim) await this.delete(victim.projectId);
  }

  private pickEvictionVictim(all: ProxyRecord[], incomingId: string): ProxyRecord | null {
    const candidates = all
      .filter((r) => r.projectId !== incomingId)
      .sort((a, b) => a.lastAccessed - b.lastAccessed);
    return candidates[0] ?? null;
  }
}
