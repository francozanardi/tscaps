import type { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { TelemetryBudget } from '@core/telemetry/services/TelemetryBudget';

const EVENT_CAP = 30;
const FIELDS = ['format', 'fit', 'backdrop'] as const;

/**
 * Reports each pick in the output frame's cards: the shape the video is
 * exported in, whether it fills or fits it, and what shows around it.
 * Where the crop sits is left out, since it moves with every step of a
 * drag. At most 30 events a page load.
 */
export class OutputFrameTelemetryReporter {
  constructor(
    private readonly telemetry: Telemetry,
    private readonly budget: TelemetryBudget,
  ) {}

  /** One event for each of the three fields that differs between `before` and `after`. */
  changed(before: OutputFrame, after: OutputFrame): void {
    for (const field of FIELDS) {
      if (before[field] === after[field]) continue;
      if (!this.budget.allows('output_frame_set', EVENT_CAP)) return;
      this.telemetry.capture('output_frame_set', { field, value: after[field], previous_value: before[field] });
    }
  }
}
