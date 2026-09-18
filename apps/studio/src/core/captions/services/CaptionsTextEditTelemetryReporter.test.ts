import { describe, expect, it } from 'vitest';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { TelemetryEventName } from '@core/telemetry/domain/TelemetryEventName';
import type { TelemetryEventProperties } from '@shared/telemetry';
import { CaptionsTextEditTelemetryReporter } from '@core/captions/services/CaptionsTextEditTelemetryReporter';

/**
 * The once-per-page-load guard is the whole point of this class.
 *
 * The actions calling it run on every keystroke, so dropping the guard
 * does not break anything visible — it floods the backend with an event
 * per character while every dashboard built on "did anyone edit the
 * text" keeps answering yes. Nothing fails loudly, which is why the
 * behaviour is pinned here.
 */

interface CapturedEvent {
  readonly name: TelemetryEventName;
  readonly properties: TelemetryEventProperties | undefined;
}

function recordingTelemetry(): { port: Telemetry; captured: CapturedEvent[] } {
  const captured: CapturedEvent[] = [];
  return {
    captured,
    port: {
      capture: (name, properties) => { captured.push({ name, properties }); },
    },
  };
}

describe('reporting that the caption text was edited', () => {
  it('reports the first edit, tagged with its kind', () => {
    const { port, captured } = recordingTelemetry();

    new CaptionsTextEditTelemetryReporter(port).report('segment-text');

    expect(captured).toHaveLength(1);
    expect(captured[0]!.name).toBe('captions_text_edited');
    expect(captured[0]!.properties).toEqual({ kind: 'segment-text' });
  });

  it('stays silent for every later edit, whatever its kind', () => {
    const { port, captured } = recordingTelemetry();
    const reporter = new CaptionsTextEditTelemetryReporter(port);

    reporter.report('segment-text');
    reporter.report('segment-text');
    reporter.report('word-text');
    reporter.report('structure');

    expect(captured).toHaveLength(1);
    expect(captured[0]!.properties).toEqual({ kind: 'segment-text' });
  });
});
