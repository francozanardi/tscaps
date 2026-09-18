import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
import {
  IndexedDbLruProjectCache,
  type ProjectCacheEntry,
} from '@core/_shared/infrastructure/IndexedDbLruProjectCache';
import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';

const STORE = 'video-proxies';
const ACCESS_STORE = 'video-proxies-access';

interface ProxyEntry extends ProjectCacheEntry {
  readonly blob: Blob;
  readonly mimeType: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * `PreviewProxyRepository` backed by the shared `video-proxies`
 * IndexedDB store, holding the proxies of the `maxCachedProjects`
 * most recently read projects.
 *
 * `maxCachedProjects` has to match the source-video cache's: a proxy
 * without its source opens the editor on a project it cannot export,
 * and the fast path relies on the two evicting together.
 *
 * A proxy whose bytes cannot be read is no proxy: publishing it would
 * put an unplayable preview in front of the reader, and `null` sends
 * the caller to the source like any project without one.
 */
export class IndexedDbPreviewProxyRepository implements PreviewProxyRepository {
  private readonly entries: IndexedDbLruProjectCache<ProxyEntry>;

  constructor(
    db: IndexedDbClient,
    private readonly probe: BlobReadabilityProbe,
    maxCachedProjects: number,
  ) {
    this.entries = new IndexedDbLruProjectCache<ProxyEntry>(db, STORE, ACCESS_STORE, maxCachedProjects);
  }

  async load(projectId: string): Promise<PreviewProxy | null> {
    const entry = await this.entries.read(projectId);
    if (!entry) return null;
    const readability = await this.probe.probe(entry.blob);
    if (readability !== 'readable') {
      // A refused read may go through next time, so only a file that
      // is gone costs the project its slot.
      if (readability === 'gone') await this.entries.delete(projectId);
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
    return this.entries.delete(projectId);
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
