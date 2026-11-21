import { describe, expect, it } from 'vitest';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { EditorStore } from '@core/editor/store/EditorStore';
import { SetOutputFrameAction } from '@core/output-frame/actions/SetOutputFrameAction';
import { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import { OutputFrameTelemetryReporter } from '@core/output-frame/services/OutputFrameTelemetryReporter';
import type { TelemetryEventName } from '@core/telemetry/domain/TelemetryEventName';
import { TelemetryBudget } from '@core/telemetry/services/TelemetryBudget';
import type { TelemetryEventProperties } from '@shared/telemetry';

/**
 * Changing the output frame: the frame's size follows from the video's,
 * captions are laid out again only when that size changes, and every
 * change is one undo step — a drag of the crop position included.
 */

/** Counts the times the captions are laid out again, which is all the action asks of it. */
class CountingRefresh {
  count = 0;
  execute(): void {
    this.count++;
  }
}

function setUp() {
  const store = new EditorStore();
  store.patchVideo({ layout: { width: 1920, height: 1080 } });
  const refresh = new CountingRefresh();
  const events: Array<[TelemetryEventName, TelemetryEventProperties | undefined]> = [];
  const telemetry = { capture: (name: TelemetryEventName, properties?: TelemetryEventProperties) => { events.push([name, properties]); } };
  const action = new SetOutputFrameAction(
    store,
    refresh as unknown as RefreshDocumentAction,
    new OutputFrameTelemetryReporter(telemetry, new TelemetryBudget({ historyGroupAuthor: null })),
  );
  return { store, refresh, action, events };
}

const VERTICAL = OutputFrame.original().withFormat('9:16');

describe('SetOutputFrameAction', () => {
  it('puts the video in a frame of the shape asked, keeping its shorter side, and lays captions out again', () => {
    const { store, refresh, action } = setUp();

    action.execute(VERTICAL);

    expect(store.snapshot().outputFrame.format).toBe('9:16');
    expect(store.snapshot().frameLayout).toEqual({ width: 1080, height: 1920 });
    expect(refresh.count).toBe(1);
  });

  it('leaves the captions be where the frame keeps its size', () => {
    const { store, refresh, action } = setUp();
    action.execute(VERTICAL);

    action.execute(VERTICAL.withFit('fit'));
    action.execute(VERTICAL.withPosition({ x: 0.2, y: 0.5 }));

    expect(store.snapshot().frameLayout).toEqual({ width: 1080, height: 1920 });
    expect(refresh.count).toBe(1);
  });

  it('takes a run of crop moves back in one undo, and the shape in another', () => {
    const { store, action } = setUp();
    action.execute(VERTICAL);
    for (const x of [0.4, 0.3, 0.2]) action.execute(VERTICAL.withPosition({ x, y: 0.5 }));

    store.undo();
    expect(store.snapshot().outputFrame.position.x).toBe(0.5);
    expect(store.snapshot().outputFrame.format).toBe('9:16');

    store.undo();
    expect(store.snapshot().outputFrame.isOriginal()).toBe(true);
    expect(store.snapshot().frameLayout).toEqual({ width: 1920, height: 1080 });
  });

  it('changes nothing for the frame it already has', () => {
    const { store, refresh, action } = setUp();

    action.execute(OutputFrame.original());

    expect(store.snapshot().canUndo).toBe(false);
    expect(refresh.count).toBe(0);
  });

  it('reports each card picked with what it replaced, and nothing for the crop being dragged', () => {
    const { action, events } = setUp();

    action.execute(VERTICAL);
    for (const x of [0.4, 0.3]) action.execute(VERTICAL.withPosition({ x, y: 0.5 }));
    action.execute(VERTICAL.withPosition({ x: 0.3, y: 0.5 }).withFit('fit').withBackdrop('black'));

    expect(events).toEqual([
      ['output_frame_set', { field: 'format', value: '9:16', previous_value: 'original' }],
      ['output_frame_set', { field: 'fit', value: 'fit', previous_value: 'fill' }],
      ['output_frame_set', { field: 'backdrop', value: 'black', previous_value: 'blur' }],
    ]);
  });
});
