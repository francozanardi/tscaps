import type { ExportPauseReason } from '@core/export/domain/ExportRun';
import type { ExportStore } from '@core/export/store/ExportStore';

/**
 * Coordinates a transient export pause: holds the pending resolver for
 * the export pipeline's confirmation Promise and mirrors the pause
 * reason into the {@link ExportStore} so the UI can render the
 * prompt. The export pipeline awaits {@link pauseAndAwait}; thin
 * actions call {@link resume} once the user decides.
 */
export class ExportPauseCoordinator {

  private resolver: ((accepted: boolean) => void) | null = null;

  constructor(private readonly exportStore: ExportStore) {}

  /**
   * Suspends the caller until the user accepts or rejects the pause.
   * Concurrent pauses are not supported: a second call while one is
   * pending settles the previous one as rejected so the caller doesn't
   * hang.
   */
  pauseAndAwait(reason: ExportPauseReason): Promise<boolean> {
    if (this.resolver) {
      const stale = this.resolver;
      this.resolver = null;
      stale(false);
    }
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
      this.exportStore.setPauseReason(reason);
    });
  }

  resume(accepted: boolean): void {
    const resolver = this.resolver;
    if (!resolver) return;
    this.resolver = null;
    this.exportStore.setPauseReason(null);
    resolver(accepted);
  }
}
