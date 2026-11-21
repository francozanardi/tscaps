import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
import type { ProjectCacheEntry } from '@core/_shared/infrastructure/IndexedDbLruProjectCache';
import { IndexedDbProjectStore } from '@core/_shared/infrastructure/IndexedDbProjectStore';
import type { ProjectDependentStore } from '@core/_shared/infrastructure/ProjectDependentStore';
import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';

export const VIDEO_PROXIES_STORE = 'video-proxies';

interface ProxyEntry extends ProjectCacheEntry {
  readonly blob: Blob;
  readonly mimeType: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * `PreviewProxyRepository` backed by the shared `video-proxies`
 * IndexedDB store, one proxy per project.
 *
 * It keeps no eviction order of its own. A proxy lives exactly as long
 * as its project's source video on this device — the video cache drops
 * it as a dependent — since a proxy without its source opens the
 * editor on a project it cannot export.
 *
 * A proxy whose bytes cannot be read is no proxy: publishing it would
 * put an unplayable preview in front of the reader, and `null` sends
 * the caller to the source like any project without one.
 */
export class IndexedDbPreviewProxyRepository implements PreviewProxyRepository, ProjectDependentStore {
  private readonly entries: IndexedDbProjectStore<ProxyEntry>;

  constructor(
    db: IndexedDbClient,
    private readonly probe: BlobReadabilityProbe,
  ) {
    this.entries = new IndexedDbProjectStore<ProxyEntry>(db, VIDEO_PROXIES_STORE);
  }

  async load(projectId: string): Promise<PreviewProxy | null> {
    const entry = await this.entries.read(projectId);
    if (!entry) return null;
    const readability = await this.probe.probe(entry.blob);
    if (readability !== 'readable') {
      // A refused read may go through next time, so only a file that
      // is gone costs the project its slot.
      if (readability === 'gone') await this.entries.deleteProject(projectId);
      return null;
    }
    return this.toProxy(entry);
  }

  store(projectId: string, proxy: PreviewProxy): Promise<void> {
    return this.entries.write(projectId, {
      blob: proxy.blob,
      mimeType: proxy.mimeType,
      widthPx: proxy.widthPx,
      heightPx: proxy.heightPx,
    });
  }

  delete(projectId: string): Promise<void> {
    return this.entries.deleteProject(projectId);
  }

  deleteProject(projectId: string): Promise<void> {
    return this.entries.deleteProject(projectId);
  }

  evictProject(projectId: string): Promise<void> {
    return this.entries.evictProject(projectId);
  }

  retainOnly(projectIds: ReadonlySet<string>): Promise<void> {
    return this.entries.retainOnly(projectIds);
  }

  private toProxy(entry: ProxyEntry): PreviewProxy {
    return {
      blob: entry.blob,
      mimeType: entry.mimeType,
      widthPx: entry.widthPx,
      heightPx: entry.heightPx,
    };
  }
}
