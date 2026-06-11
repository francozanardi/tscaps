import type { ExportStore } from '@core/export/store/ExportStore';

/**
 * Clears the lingering export notice (e.g. "audio was dropped") after
 * the user acknowledges it.
 */
export class DismissExportNoticeAction {

  constructor(private readonly exportStore: ExportStore) {}

  execute(): void {
    this.exportStore.dismissNotice();
  }
}
