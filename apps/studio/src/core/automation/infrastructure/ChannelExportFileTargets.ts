import type { AutomationChannel } from '@core/automation/domain/AutomationChannel';
import type { ExportFileTarget, ExportFileTargets } from '@core/automation/domain/ExportFileTarget';
import { ChannelExportFileTarget } from '@core/automation/infrastructure/ChannelExportFileTarget';

/** Makes targets that send an export's bytes over the automation channel. */
export class ChannelExportFileTargets implements ExportFileTargets {
  constructor(private readonly channel: AutomationChannel) {}

  targetFor(fileId: string): ExportFileTarget {
    return new ChannelExportFileTarget(this.channel, fileId);
  }
}
