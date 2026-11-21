import { describe, expect, it } from 'vitest';
import { RecordingShotTelemetry } from '@core/shots/testing/RecordingShotTelemetry';

/** One page load sends at most thirty of each event, and moving a boundary once. */
describe('ShotEditTelemetryReporter', () => {
  it('caps each event per page load, and reports a moved boundary once', () => {
    const telemetry = new RecordingShotTelemetry();

    for (let index = 0; index < 40; index += 1) {
      telemetry.edits.transitionSet('whip', null, true);
      telemetry.edits.partitionEdited('move-boundary', false);
    }

    expect(telemetry.propertiesOf('shot_transition_set')).toHaveLength(30);
    expect(telemetry.propertiesOf('shot_partition_edited')).toHaveLength(1);
  });
});
