import { describe, expect, it } from 'vitest';
import { GraphicFrameFailedError } from '@core/graphics/domain/errors/GraphicFrameFailedError';
import { GraphicOpenFailedError } from '@core/graphics/domain/errors/GraphicOpenFailedError';
import type { GraphicFailureStage } from '@core/graphics/domain/GraphicFailureStage';
import type { GraphicPlayer } from '@core/graphics/domain/GraphicPlayer';
import type { GraphicPlayerFactory } from '@core/graphics/domain/GraphicPlayerFactory';
import type { GraphicStage } from '@core/graphics/domain/GraphicStage';
import { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';
import { GraphicFootagePictureProvider } from '@core/graphics/services/GraphicFootagePictureProvider';
import { GraphicTelemetryDescriber } from '@core/graphics/services/GraphicTelemetryDescriber';
import { ErrorNameTelemetryDescriber } from '@core/errors/services/ErrorNameTelemetryDescriber';
import { TelemetryShotGraphicFailureRecorder } from '@core/shots/services/TelemetryShotGraphicFailureRecorder';
import type { TelemetryEventName } from '@core/telemetry/domain/TelemetryEventName';
import type { TelemetryEventProperties } from '@shared/telemetry';

/**
 * A graphic whose code breaks is reported once per layer and stage, by the
 * names of the error and its cause and the preset it came from, never by
 * what its code said; a picture refused because the graphic was closed is
 * no failure.
 */

const presets = new BuiltinGraphicPresetCatalog();
const starter = presets.starter();
const STAGE: GraphicStage = { widthPx: 10, heightPx: 10, fps: 30, seed: 1, durationSec: 1, params: {} };

function recorder(): { recorder: TelemetryShotGraphicFailureRecorder; events: Array<[TelemetryEventName, TelemetryEventProperties | undefined]> } {
  const events: Array<[TelemetryEventName, TelemetryEventProperties | undefined]> = [];
  return {
    recorder: new TelemetryShotGraphicFailureRecorder(
      { capture: (name, properties) => { events.push([name, properties]); } },
      new GraphicTelemetryDescriber(presets, presets),
      new ErrorNameTelemetryDescriber(),
    ),
    events,
  };
}

function providerOver(players: GraphicPlayerFactory, failures: Array<[GraphicFailureStage, unknown]>): GraphicFootagePictureProvider {
  return new GraphicFootagePictureProvider(
    players,
    starter.graphic.document,
    STAGE,
    () => undefined,
    () => undefined,
    (stage, error) => failures.push([stage, error]),
  );
}

function playerFailingFrames(): GraphicPlayer {
  return {
    moments: [],
    frameAt: () => Promise.reject(new GraphicFrameFailedError({ cause: new Error('secret words from the code') })),
    frameOf: (sec) => sec,
    textLayout: () => null,
    dispose: () => undefined,
  };
}

describe('graphic failures', () => {
  it('reports one that never starts, and one that fails to draw, by name only', () => {
    const { recorder: failures, events } = recorder();
    const thrown = new GraphicOpenFailedError({ cause: new TypeError('secret words from the code') });

    failures.record('g1', starter.graphic, 'open', thrown);
    failures.record('g1', starter.graphic, 'open', thrown);
    failures.record('g1', starter.graphic, 'frame', new GraphicFrameFailedError({ cause: new Error('x') }));

    expect(events).toEqual([
      ['graphic_failed', { stage: 'open', preset: starter.id, code_edited: false, error_name: 'GraphicOpenFailedError', error_cause_name: 'TypeError', http_status: null }],
      ['graphic_failed', { stage: 'frame', preset: starter.id, code_edited: false, error_name: 'GraphicFrameFailedError', error_cause_name: 'Error', http_status: null }],
    ]);
    expect(JSON.stringify(events)).not.toContain('secret');
  });

  it('hears of a graphic that could not open, and still refuses its opening', async () => {
    const failures: Array<[GraphicFailureStage, unknown]> = [];
    const thrown = new GraphicOpenFailedError({ cause: new Error('no') });
    const provider = providerOver({ open: () => Promise.reject(thrown) }, failures);

    await expect(provider.open(1)).rejects.toBe(thrown);
    expect(failures).toEqual([['open', thrown]]);
  });

  it('hears of a picture that failed while the graphic was open, not of one refused after it closed', async () => {
    const failures: Array<[GraphicFailureStage, unknown]> = [];
    const pictures = await providerOver({ open: async () => playerFailingFrames() }, failures).open(1);

    await expect(pictures.pictureAt(0)).rejects.toBeInstanceOf(GraphicFrameFailedError);
    pictures.close();
    await expect(pictures.pictureAt(0.1)).rejects.toBeInstanceOf(GraphicFrameFailedError);

    expect(failures.map(([stage]) => stage)).toEqual(['frame']);
  });
});
