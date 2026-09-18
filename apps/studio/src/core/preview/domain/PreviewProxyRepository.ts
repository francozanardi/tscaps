import type { BlobDownloadProgressCallback } from '@core/_shared/domain/BlobDownloader';
import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';

/**
 * Per-project persistence for preview proxies. `load` resolves to
 * `null` when no proxy is available; a miss never triggers
 * generation. Implementations may cap the number of stored entries
 * and evict on LRU.
 *
 * `onProgress` is only ever called by an implementation that has to
 * pull the proxy over the network; one answering from local storage
 * leaves it untouched, so a caller cannot read "no progress reported"
 * as "nothing happened".
 */
export interface PreviewProxyRepository {
  load(projectId: string, onProgress?: BlobDownloadProgressCallback): Promise<PreviewProxy | null>;
  store(projectId: string, proxy: PreviewProxy): Promise<void>;
  delete(projectId: string): Promise<void>;
}
