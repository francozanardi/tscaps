import type { OutdatedPageTrigger } from '@core/_shared/infrastructure/IndexedDbClient';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';

/**
 * Reports that the reader was told this tab runs an older version of
 * the app than the one already used in this browser: how the tab
 * found out, and whether reloading it would lose work the reader
 * could otherwise keep.
 *
 * Once for as long as the instance lives, which is meant to be the
 * page load: the condition never clears without a reload, so a second
 * report would only count the same tab twice.
 */
export class OutdatedPageTelemetryReporter {
  private reported = false;

  constructor(private readonly telemetry: Telemetry) {}

  shown(trigger: OutdatedPageTrigger, unsavedWork: boolean): void {
    if (this.reported) return;
    this.reported = true;
    this.telemetry.capture('page_outdated_shown', { trigger, unsaved_work: unsavedWork });
  }
}
