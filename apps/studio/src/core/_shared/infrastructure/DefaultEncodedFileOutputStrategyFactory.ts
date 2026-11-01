import type { EncodedFileOutputStrategy } from '@core/_shared/domain/EncodedFileOutputStrategy';
import type { EncodedFileOutputStrategyFactory } from '@core/_shared/domain/EncodedFileOutputStrategyFactory';
import { MemoryEncodedFileOutputStrategy } from '@core/_shared/infrastructure/MemoryEncodedFileOutputStrategy';
import { OpfsEncodedFileOutputStrategy } from '@core/_shared/opfs/OpfsEncodedFileOutputStrategy';
import type { WorkerErrorMonitor } from '@core/_shared/workers/WorkerErrorMonitor';

/**
 * Picks the output strategy for an encoding run. Prefers the
 * OPFS-backed strategy on every platform so the encoded file never
 * accumulates in the heap — that heap pressure was tipping
 * memory-constrained tabs into the OOM killer on mobile and pushing
 * peak RAM up by ~250 MB on desktop for a preview proxy alone.
 *
 * Falls back to the memory strategy when OPFS is not available on
 * the current runtime.
 *
 * `filePrefix` names the kind of file this factory's runs produce;
 * see {@link OpfsEncodedFileOutputStrategy} for why two kinds must
 * never share one.
 */
export class DefaultEncodedFileOutputStrategyFactory implements EncodedFileOutputStrategyFactory {

  constructor(
    private readonly workerErrorMonitor: WorkerErrorMonitor,
    private readonly filePrefix: string,
  ) {}

  create(): EncodedFileOutputStrategy {
    if (OpfsEncodedFileOutputStrategy.isSupported()) {
      const worker = new Worker(
        new URL('../opfs/opfsWriterWorker.ts', import.meta.url),
        { type: 'module' },
      );
      this.workerErrorMonitor.monitor(worker, 'opfs-writer-worker');
      return new OpfsEncodedFileOutputStrategy(worker, this.filePrefix);
    }
    return new MemoryEncodedFileOutputStrategy();
  }
}
