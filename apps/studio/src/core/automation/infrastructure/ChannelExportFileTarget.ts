import type { AutomationChannel } from '@core/automation/domain/AutomationChannel';
import type { ExportFileOutcome, ExportFileTarget } from '@core/automation/domain/ExportFileTarget';
import type { ExportWriter } from '@core/export/domain/ExportWriter';
import { ChannelExportWriter } from '@core/automation/infrastructure/ChannelExportWriter';

/** One file's target: every writer it builds sends to that file over the channel. */
export class ChannelExportFileTarget implements ExportFileTarget {
  private last: ChannelExportWriter | null = null;

  constructor(
    private readonly channel: AutomationChannel,
    private readonly fileId: string,
  ) {}

  create(): ExportWriter {
    this.last = new ChannelExportWriter(this.channel, this.fileId);
    return this.last;
  }

  outcome(): ExportFileOutcome {
    return this.last?.outcome() ?? { kind: 'not-started' };
  }
}
