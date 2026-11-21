import { Document } from '@tscaps/engine';
import { describe, expect, it } from 'vitest';
import { EditSegmentTimeAction } from '@core/captions/actions/segments/EditSegmentTimeAction';
import { InsertSegmentAction } from '@core/captions/actions/segments/InsertSegmentAction';
import { RedistributeSegmentWordsAction } from '@core/captions/actions/segments/RedistributeSegmentWordsAction';
import { EditWordTextAction } from '@core/captions/actions/words/EditWordTextAction';
import { CaptionsTextEditTelemetryReporter } from '@core/captions/services/CaptionsTextEditTelemetryReporter';
import { SegmentHardTime } from '@core/captions/services/SegmentHardTime';
import { SegmentTimeBounds } from '@core/captions/services/SegmentTimeBounds';
import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { InsertCaptionOperation } from '@core/editor-operations/services/descriptors/InsertCaptionOperation';
import { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';
import { SheetOperationsFixture } from '@core/editor-operations/testing/SheetOperationsFixture';

function operationOn(fixture: SheetOperationsFixture): InsertCaptionOperation {
  const { store, parser, project } = fixture;
  const deriver = project.deriverFor(store);
  const hardTime = new SegmentHardTime();
  const segmentBounds = new SegmentTimeBounds(hardTime);
  return new InsertCaptionOperation(
    store,
    parser,
    new CaptionRefResolver(store, parser),
    hardTime,
    segmentBounds,
    new InsertSegmentAction(store, deriver, () => store.snapshot().video.duration, hardTime, segmentBounds),
    new EditSegmentTimeAction(store, deriver, segmentBounds),
    new EditWordTextAction(store, deriver, new CaptionsTextEditTelemetryReporter({ capture: () => {} }, store)),
    new RedistributeSegmentWordsAction(store, deriver),
    new ReadoutFormatter(),
  );
}

function scenesOf(fixture: SheetOperationsFixture, sheetId: string): string[] {
  return fixture.store.snapshot().document!.sections
    .filter((section) => section.kind === sheetId)
    .flatMap((section) => section.segments.map((segment) => segment.getText()));
}

describe('insert_caption', () => {
  it('adds a scene after the one named, showing its text over the time asked', async () => {
    const fixture = new SheetOperationsFixture();

    const result = await operationOn(fixture).run({ text: 'Big news today', startSec: 1.2, endSec: 1.9, after: 'segment:s1' });

    expect(result.ok).toBe(true);
    const { caption, words } = result.output as { caption: string; words: string[] };
    const scene = fixture.store.snapshot().document!.getSegments().find((segment) => `segment:${segment.id}` === caption)!;
    expect(scenesOf(fixture, 'main')).toEqual(['Hello world', 'Big news today', 'Again here']);
    expect([scene.time.start, scene.time.end]).toEqual([1.2, 1.9]);
    expect(words).toEqual(scene.getWords().map((word) => `word:${word.id}`));
    const times = scene.getWords().map((word) => [word.time.start, word.time.end]);
    expect(times[0]![0]).toBeCloseTo(1.2);
    expect(times[2]![1]).toBeCloseTo(1.9);
    expect(times[1]![0]).toBeCloseTo(times[0]![1]!);
  });

  it('refuses a time reaching into the next scene on its sheet, answering the free time', async () => {
    const fixture = new SheetOperationsFixture();
    const before = fixture.store.snapshot();

    const result = await operationOn(fixture).run({ text: 'Too long', startSec: 1.5, endSec: 2.5, after: 'segment:s1' });

    expect(result.ok).toBe(false);
    expect(result.problems[0]!.message).toContain('1 s to 2 s');
    expect(fixture.store.snapshot()).toBe(before);
  });

  it('adds the first caption of a video that has none', async () => {
    const fixture = new SheetOperationsFixture();
    fixture.store.patch({ document: new Document({ sections: [] }) });

    const result = await operationOn(fixture).run({ text: 'Hello there', startSec: 0.5, endSec: 2 });

    expect(result.ok).toBe(true);
    const scenes = fixture.store.snapshot().document!.getSegments();
    expect(scenes.map((segment) => [segment.getText(), segment.time.start, segment.time.end])).toEqual([['Hello there', 0.5, 2]]);
  });

  it('asks which scene to go beside when the video has captions', async () => {
    const fixture = new SheetOperationsFixture();
    const before = fixture.store.snapshot();

    const result = await operationOn(fixture).run({ text: 'Lost', startSec: 4, endSec: 4.5 });

    expect(result.ok).toBe(false);
    expect(fixture.store.snapshot()).toBe(before);
  });
});
