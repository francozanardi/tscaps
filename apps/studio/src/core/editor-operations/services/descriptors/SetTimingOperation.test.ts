import { describe, expect, it } from 'vitest';
import { EditSegmentTimeAction } from '@core/captions/actions/segments/EditSegmentTimeAction';
import { EditWordTextAction } from '@core/captions/actions/words/EditWordTextAction';
import { EditWordTimeAction } from '@core/captions/actions/words/EditWordTimeAction';
import { AddDecorationAction } from '@core/captions/actions/decorations/AddDecorationAction';
import { CaptionsTextEditTelemetryReporter } from '@core/captions/services/CaptionsTextEditTelemetryReporter';
import { SegmentHardTime } from '@core/captions/services/SegmentHardTime';
import { SegmentTimeBounds } from '@core/captions/services/SegmentTimeBounds';
import { WordTimeBounds } from '@core/captions/services/WordTimeBounds';
import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { SetTimingOperation } from '@core/editor-operations/services/descriptors/SetTimingOperation';
import { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';
import { SheetOperationsFixture } from '@core/editor-operations/testing/SheetOperationsFixture';

function operationOn(fixture: SheetOperationsFixture): SetTimingOperation {
  const { store, parser, project } = fixture;
  const deriver = project.deriverFor(store);
  const segmentBounds = new SegmentTimeBounds(new SegmentHardTime());
  return new SetTimingOperation(
    new CaptionRefResolver(store, parser),
    store,
    new EditWordTimeAction(store, deriver, new WordTimeBounds(), segmentBounds),
    new EditSegmentTimeAction(store, deriver, segmentBounds),
    new ReadoutFormatter(),
  );
}

function wordTime(fixture: SheetOperationsFixture, wordId: string): [number, number] {
  const word = fixture.store.snapshot().document!.getWords().find((each) => each.id === wordId)!;
  return [word.time.start, word.time.end];
}

function sceneTime(fixture: SheetOperationsFixture, segmentId: string): [number, number] {
  const segment = fixture.store.snapshot().document!.getSegments().find((each) => each.id === segmentId)!;
  return [segment.time.start, segment.time.end];
}

describe('set_timing', () => {
  it('keeps a scene\'s window through a word of it retyped and an emoji put on one, as the editor\'s own text and emoji edits do', async () => {
    const fixture = new SheetOperationsFixture();
    const deriver = fixture.project.deriverFor(fixture.store);
    await operationOn(fixture).run({ scenes: [{ segment: 'segment:s2', startSec: 1.8, endSec: 3.4 }] });
    const sceneWords = fixture.store.snapshot().document!.getSegments().find((each) => each.id === 's2')!.lines.flatMap((line) => line.words);

    new EditWordTextAction(fixture.store, deriver, new CaptionsTextEditTelemetryReporter({ capture: () => {} }, fixture.store)).execute(sceneWords[0]!.id, 'retyped');
    new AddDecorationAction(fixture.store, deriver).execute(sceneWords[0]!.id, '🔥');

    expect(sceneTime(fixture, 's2')).toEqual([1.8, 3.4]);
  });

  it('sets the times of the words and scenes named, answering them', async () => {
    const fixture = new SheetOperationsFixture();

    const result = await operationOn(fixture).run({
      words: [{ word: 'word:w1', startSec: 0.1, endSec: 0.4 }],
      scenes: [{ segment: 'segment:s2', startSec: 1.8, endSec: 3.4 }],
    });

    expect(result).toEqual({
      ok: true,
      output: { words: [{ word: 'word:w1', startSec: 0.1, endSec: 0.4 }], scenes: [{ segment: 'segment:s2', startSec: 1.8, endSec: 3.4 }] },
      problems: [],
    });
    expect(wordTime(fixture, 'w1')).toEqual([0.1, 0.4]);
    expect(sceneTime(fixture, 's2')).toEqual([1.8, 3.4]);
  });

  it('shifts a run of words past where each other were, in one call', async () => {
    const fixture = new SheetOperationsFixture();

    const result = await operationOn(fixture).run({
      words: [{ word: 'word:w3', startSec: 3, endSec: 3.5 }, { word: 'word:w4', startSec: 3.5, endSec: 4 }],
    });

    expect(result.problems).toEqual([]);
    expect([wordTime(fixture, 'w3'), wordTime(fixture, 'w4')]).toEqual([[3, 3.5], [3.5, 4]]);
  });

  it('holds a scene clear of the one before it on its sheet, and says so', async () => {
    const fixture = new SheetOperationsFixture();

    const result = await operationOn(fixture).run({ scenes: [{ segment: 'segment:s2', startSec: 0.5, endSec: 3 }] });

    expect(result.ok).toBe(true);
    expect(sceneTime(fixture, 's2')).toEqual([1, 3]);
    expect(result.problems.map((problem) => problem.severity)).toEqual(['warning']);
  });

  it('warns that words left outside a shortened scene are spoken but not shown', async () => {
    const fixture = new SheetOperationsFixture();

    const result = await operationOn(fixture).run({ scenes: [{ segment: 'segment:s2', startSec: 2, endSec: 2.5 }] });

    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]!.message).toContain('word:w4');
  });

  it('changes nothing when any entry is bad', async () => {
    const fixture = new SheetOperationsFixture();
    const operation = operationOn(fixture);
    const before = fixture.store.snapshot();

    const backwards = await operation.run({ words: [{ word: 'word:w1', startSec: 0.1, endSec: 0.4 }, { word: 'word:w2', startSec: 0.9, endSec: 0.6 }] });
    const gone = await operation.run({ scenes: [{ segment: 'segment:s1', startSec: 0, endSec: 1 }, { segment: 'segment:gone', startSec: 2, endSec: 3 }] });
    const pastTheEnd = await operation.run({ scenes: [{ segment: 'segment:s2', startSec: 2, endSec: 12 }] });

    expect([backwards.ok, gone.ok, pastTheEnd.ok]).toEqual([false, false, false]);
    expect(fixture.store.snapshot()).toBe(before);
  });
});
