import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
import type { ProjectDependentStore } from '@core/_shared/infrastructure/ProjectDependentStore';
import {
  IndexedDbLruProjectCache,
  type ProjectCacheEntry,
} from '@core/_shared/infrastructure/IndexedDbLruProjectCache';
import type { VideoBlobCache } from '@core/videos/domain/VideoBlobCache';
import type { VideoBlobLookup } from '@core/videos/domain/VideoBlobLookup';

const STORE = 'videos';
const ACCESS_STORE = 'videos-access';

interface VideoEntry extends ProjectCacheEntry {
  readonly blob: Blob;
}

/**
 * `VideoBlobCache` backed by the shared `videos` IndexedDB store,
 * holding the source bytes of the `maxCachedProjects` most recently
 * read projects so they re-open without prompting a re-select or a
 * re-download.
 *
 * Bytes that cannot be read are a miss, not an error: the record
 * comes back from the database but the file behind it does not.
 *
 * This is the cache that decides which projects are on the device.
 * Everything else a project keeps here — its proxy, its masks, its
 * media — is one of `dependents`, and goes when its video does: a
 * proxy that outlived its source opened a project that could not be
 * exported.
 */
export class IndexedDbVideoBlobCache implements VideoBlobCache {
  private readonly entries: IndexedDbLruProjectCache<VideoEntry>;

  constructor(
    db: IndexedDbClient,
    private readonly probe: BlobReadabilityProbe,
    maxCachedProjects: number,
    dependents: ProjectDependentStore,
  ) {
    this.entries = new IndexedDbLruProjectCache<VideoEntry>(db, STORE, ACCESS_STORE, maxCachedProjects, dependents);
  }

  async load(projectId: string): Promise<VideoBlobLookup> {
    const entry = await this.entries.read(projectId);
    if (!entry) return { outcome: 'missing', reason: 'absent' };
    const readability = await this.probe.probe(entry.blob);
    if (readability !== 'readable') {
      // A refused read may go through next time, so only a file that
      // is gone costs the project its slot.
      if (readability === 'gone') await this.entries.evict(projectId);
      return { outcome: 'missing', reason: 'stored-bytes-gone' };
    }
    return { outcome: 'found', blob: entry.blob, source: 'device' };
  }

  store(projectId: string, blob: Blob): Promise<void> {
    return this.entries.write(projectId, { blob });
  }

  delete(projectId: string): Promise<void> {
    return this.entries.delete(projectId);
  }
}
