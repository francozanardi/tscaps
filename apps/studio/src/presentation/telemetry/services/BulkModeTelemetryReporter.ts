import type { Telemetry } from '@core/telemetry/domain/Telemetry';

export type BulkTelemetryTarget = 'scenes' | 'words';

export type BulkTelemetryAction = 'tags' | 'style' | 'sheet' | 'behind-actor' | 'delete';

/**
 * Reports what a transcript bulk-selection session was used for: one
 * event the first time each kind of action is applied, and one on the
 * way out carrying how many kinds that was.
 *
 * Each kind reports once per session because styling fans out on
 * every slider step, so a session spent on one colour would otherwise
 * drown out every other session. What the events answer is which
 * actions a selection gets used for, and that survives the cap.
 *
 * The exit event is what separates a session that did something from
 * one that was opened and abandoned, which the action events alone
 * cannot say. It reports when the visitor closes the session; one
 * left open when the tab goes away is not counted.
 */
export class BulkModeTelemetryReporter {

  private readonly reportedActions = new Set<BulkTelemetryAction>();

  constructor(private readonly telemetry: Telemetry) {}

  entered(): void {
    this.reportedActions.clear();
  }

  actionApplied(target: BulkTelemetryTarget, action: BulkTelemetryAction, itemCount: number): void {
    if (this.reportedActions.has(action)) return;
    this.reportedActions.add(action);
    this.telemetry.capture('bulk_action_applied', {
      target,
      action,
      item_count: itemCount,
    });
  }

  exited(target: BulkTelemetryTarget): void {
    this.telemetry.capture('bulk_mode_exited', {
      target,
      actions_applied: this.reportedActions.size,
    });
  }
}
