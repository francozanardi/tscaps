import type { ExportPauseCoordinator } from '@core/export/services/ExportPauseCoordinator';

/**
 * Tells the export pipeline to abort at the current pause prompt. The
 * in-flight export rejects with an `AbortError`, which the export
 * action handles as a clean cancellation. No-op when there is no pause
 * waiting.
 */
export class RejectExportPauseAction {

  constructor(private readonly coordinator: ExportPauseCoordinator) {}

  execute(): void {
    this.coordinator.resume(false);
  }
}
