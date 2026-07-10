import type { ExportPauseCoordinator } from '@core/export/services/ExportPauseCoordinator';

/**
 * Tells the export pipeline to continue past the current pause prompt.
 * No-op when there is no pause waiting.
 */
export class AcceptExportPauseAction {

  constructor(private readonly coordinator: ExportPauseCoordinator) {}

  execute(): void {
    this.coordinator.resume(true);
  }
}
