import { describe, expect, it } from 'vitest';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { TelemetryEventName } from '@core/telemetry/domain/TelemetryEventName';
import type { TelemetryEventProperties } from '@shared/telemetry';
import { EditorNavigationTelemetryReporter } from '@presentation/telemetry/services/EditorNavigationTelemetryReporter';

function recording(): { telemetry: Telemetry; events: Array<[TelemetryEventName, TelemetryEventProperties | undefined]> } {
  const events: Array<[TelemetryEventName, TelemetryEventProperties | undefined]> = [];
  return { telemetry: { capture: (name, properties) => { events.push([name, properties]); } }, events };
}

describe('EditorNavigationTelemetryReporter', () => {
  it('reports each mode, tab and inspector page the first time it opens, and never again', () => {
    const { telemetry, events } = recording();
    const reporter = new EditorNavigationTelemetryReporter(telemetry);

    reporter.modeOpened('captions');
    reporter.modeOpened('video');
    reporter.modeOpened('captions');
    reporter.videoTabOpened('shots');
    reporter.videoTabOpened('media');
    reporter.videoTabOpened('shots');
    reporter.inspectorTabOpened('shot', 'camera');
    reporter.inspectorTabOpened('graphic', 'camera');
    reporter.inspectorTabOpened('shot', 'camera');

    expect(events).toEqual([
      ['editor_mode_opened', { mode: 'captions' }],
      ['editor_mode_opened', { mode: 'video' }],
      ['video_tab_opened', { tab: 'shots' }],
      ['video_tab_opened', { tab: 'media' }],
      ['inspector_tab_opened', { element_kind: 'shot', tab: 'camera' }],
      ['inspector_tab_opened', { element_kind: 'graphic', tab: 'camera' }],
    ]);
  });

  it('reports the first search of the graphic presets and the first shut library, never the words searched', () => {
    const { telemetry, events } = recording();
    const reporter = new EditorNavigationTelemetryReporter(telemetry);

    reporter.graphicPresetsSearched(true);
    reporter.graphicPresetsSearched(false);
    reporter.mediaLibraryGateShown();
    reporter.mediaLibraryGateShown();

    expect(events).toEqual([
      ['graphic_presets_searched', { results_empty: true }],
      ['media_library_gate_shown', {}],
    ]);
  });
});
