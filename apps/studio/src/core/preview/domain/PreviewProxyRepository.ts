import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';

/**
 * Per-project persistence for preview proxies. `load` resolves to
 * `null` when no proxy is available; a miss never triggers
 * generation. Implementations may cap the number of stored entries
 * and evict on LRU.
 */
export interface PreviewProxyRepository {
  load(projectId: string): Promise<PreviewProxy | null>;
  store(projectId: string, proxy: PreviewProxy): Promise<void>;
  delete(projectId: string): Promise<void>;
}
