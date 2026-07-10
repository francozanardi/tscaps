import type { PreviewProxyOutputStrategy } from '@core/preview/domain/PreviewProxyOutputStrategy';
import type { PreviewProxyOutputStrategyFactory } from '@core/preview/domain/PreviewProxyOutputStrategyFactory';
import { MemoryPreviewProxyOutputStrategy } from '@core/preview/infrastructure/MemoryPreviewProxyOutputStrategy';
import { OpfsPreviewProxyOutputStrategy } from '@core/preview/infrastructure/OpfsPreviewProxyOutputStrategy';

/**
 * Picks the output strategy for a proxy-generation run. Prefers the
 * OPFS-backed strategy on every platform so the encoded proxy never
 * accumulates in the heap — that heap pressure was tipping
 * memory-constrained tabs into the OOM killer on mobile and pushing
 * peak RAM up by ~250 MB on desktop. The proxy is written to
 * IndexedDB afterwards either way, so staging it on disk in OPFS
 * costs one extra small write, not a real detour.
 *
 * Falls back to the memory strategy when OPFS is not available on
 * the current runtime.
 */
export class DefaultPreviewProxyOutputStrategyFactory implements PreviewProxyOutputStrategyFactory {

  create(): PreviewProxyOutputStrategy {
    if (OpfsPreviewProxyOutputStrategy.isSupported()) {
      const worker = new Worker(
        new URL('../../_shared/opfs/opfsWriterWorker.ts', import.meta.url),
        { type: 'module' },
      );
      return new OpfsPreviewProxyOutputStrategy(worker);
    }
    return new MemoryPreviewProxyOutputStrategy();
  }
}
