import type { ExportCancelReason } from '@core/export/domain/ExportRun';
import type { ExportCancelCoordinator } from '@core/export/services/ExportCancelCoordinator';
import type { ExportPauseCoordinator } from '@core/export/services/ExportPauseCoordinator';

/**
 * Abandons the export in flight. The run rejects with an `AbortError`
 * once the renderer reaches its next frame, and the export action ends
 * it as cancelled for `reason`; the partial file is discarded. A run
 * waiting at a pause is released from it as declined. No-op when no
 * export is running.
 */
export class CancelExportAction {

  constructor(
    private readonly cancelCoordinator: ExportCancelCoordinator,
    private readonly pauseCoordinator: ExportPauseCoordinator,
  ) {}

  execute(reason: ExportCancelReason): void {
    this.cancelCoordinator.cancel(reason);
    this.pauseCoordinator.resume(false);
  }
}
