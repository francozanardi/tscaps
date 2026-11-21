import { describe, expect, it } from 'vitest';
import type { TelemetryEventName } from '@core/telemetry/domain/TelemetryEventName';
import type { TelemetryEventProperties } from '@shared/telemetry';
import { SoundPickerVisitTelemetry } from '@presentation/telemetry/services/SoundPickerVisitTelemetry';

describe('SoundPickerVisitTelemetry', () => {
  it('reports once, as the picker closes, what was listened to and picked', () => {
    const events: Array<[TelemetryEventName, TelemetryEventProperties | undefined]> = [];
    const visit = new SoundPickerVisitTelemetry({ capture: (name, properties) => { events.push([name, properties]); } }, 'effect', 'builtin');

    visit.auditioned();
    visit.auditioned();
    visit.showedList('files');
    visit.picked('file');
    visit.closed();
    visit.closed();

    expect(events).toEqual([['sound_picker_closed', { mode: 'effect', last_list: 'files', auditioned_count: 2, picked: 'file' }]]);
  });

  it('says a picker left without a pick picked nothing', () => {
    const events: Array<[TelemetryEventName, TelemetryEventProperties | undefined]> = [];
    const visit = new SoundPickerVisitTelemetry({ capture: (name, properties) => { events.push([name, properties]); } }, 'music', 'files');

    visit.closed();

    expect(events[0]?.[1]).toMatchObject({ picked: null, auditioned_count: 0 });
  });
});
