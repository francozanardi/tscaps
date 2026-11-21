import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { EditorStore } from '@core/editor/store/EditorStore';
import { SetOutputFrameOperation } from '@core/editor-operations/services/descriptors/SetOutputFrameOperation';
import { SetOutputFrameAction } from '@core/output-frame/actions/SetOutputFrameAction';
import { OutputFrameTelemetryReporter } from '@core/output-frame/services/OutputFrameTelemetryReporter';
import { TelemetryBudget } from '@core/telemetry/services/TelemetryBudget';

/**
 * The output frame asked for by a program, from the frame there is,
 * with a warning whenever its size changes, since the captions are then
 * laid out again and their segment and line refs may change.
 */

/** Counts the times the captions are laid out again. */
class CountingRefresh {
  count = 0;
  execute(): void {
    this.count++;
  }
}

function setUp() {
  const store = new EditorStore();
  store.patch({
    document: new Document({ sections: [new Section({ kind: 'main', segments: [
      new Segment({ id: 's0', lines: [new Line({ words: [new Word({ text: 'hello', time: new TimeFragment(0, 1) })] })] }),
    ] })] }),
  });
  store.patchVideo({ layout: { width: 1920, height: 1080 } });
  const refresh = new CountingRefresh();
  const operation = new SetOutputFrameOperation(store, new SetOutputFrameAction(store, refresh as unknown as RefreshDocumentAction, new OutputFrameTelemetryReporter({ capture: () => undefined }, new TelemetryBudget({ historyGroupAuthor: null }))));
  return { store, refresh, operation };
}

describe('set_output_frame', () => {
  it('puts the video in a vertical frame, keeping its shorter side, and warns that the captions were laid out again', async () => {
    const { store, refresh, operation } = setUp();

    const result = await operation.run({ format: '9:16' });

    expect(store.snapshot().outputFrame.format).toBe('9:16');
    expect(result.output).toEqual({ format: '9:16', fit: 'fill', backdrop: 'blur', cropX: 0.5, cropY: 0.5, size: { width: 1080, height: 1920 } });
    expect(refresh.count).toBe(1);
    expect(result.problems).toEqual([
      expect.objectContaining({ severity: 'warning', message: expect.stringMatching(/segment and line refs/) }),
      expect.objectContaining({ severity: 'warning', message: expect.stringMatching(/crops the sides.*set_framing/) }),
    ]);
  });

  it('fits the video or moves its crop in the frame it has, with no warning', async () => {
    const { store, operation } = setUp();
    await operation.run({ format: '9:16' });

    const result = await operation.run({ fit: 'fit', backdrop: 'black', cropX: 0.2 });

    expect(store.snapshot().outputFrame.toSnapshot()).toEqual({ format: '9:16', fit: 'fit', backdrop: 'black', position: { x: 0.2, y: 0.5 } });
    expect(result.problems).toEqual([]);
  });

  it.each([
    ['nothing to change', {}, /at least one of format/],
    ['a shape there is not', { format: '3:2' }, /format/],
  ])('refuses %s, changing nothing', async (_, input, message) => {
    const { store, operation } = setUp();
    const before = store.snapshot();

    const result = await operation.run(input);

    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toMatch(message);
    expect(store.snapshot()).toBe(before);
  });
});
