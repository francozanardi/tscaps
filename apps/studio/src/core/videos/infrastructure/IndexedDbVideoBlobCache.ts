import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
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
 */
export class IndexedDbVideoBlobCache implements VideoBlobCache {
  private readonly entries: IndexedDbLruProjectCache<VideoEntry>;

  constructor(
    db: IndexedDbClient,
    private readonly probe: BlobReadabilityProbe,
    maxCachedProjects: number,
  ) {
    this.entries = new IndexedDbLruProjectCache<VideoEntry>(db, STORE, ACCESS_STORE, maxCachedProjects);
  }

  async load(projectId: string): Promise<VideoBlobLookup> {
    const entry = await this.entries.read(projectId);
    if (!entry) return { outcome: 'missing', reason: 'absent' };
    const readability = await this.probe.probe(entry.blob);
    if (readability !== 'readable') {
      // A refused read may go through next time, so only a file that
      // is gone costs the project its slot.
      if (readability === 'gone') await this.entries.delete(projectId);
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
