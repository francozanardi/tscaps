import { describe, expect, it } from 'vitest';
import {
  Document,
  Line,
  Section,
  Segment,
  TimeFragment,
  Word,
  type AlignmentConfig,
  type SvgFilterDefinitions,
} from '@tscaps/engine';
import { EditorStore } from '@core/editor/store/EditorStore';
import { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import { EffectRegistry } from '@core/effect/services/EffectRegistry';
import { DecorationTimeResolver } from '@core/effect/services/DecorationTimeResolver';
import { InlineEmojiPunctuationAbsorber } from '@core/effect/services/InlineEmojiPunctuationAbsorber';
import { SegmentSplitterRegistry } from '@core/segment-splitter/services/SegmentSplitterRegistry';
import { LineSplitterRegistry } from '@core/line-splitter/services/LineSplitterRegistry';
import type { SheetCssVarsBuilder } from '@core/sheets/services/SheetCssVarsBuilder';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import { Template } from '@core/templates/domain/Template';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import { Sheet } from '@core/sheets/domain/Sheet';
import { ShiftSegmentsTimeAction } from '@core/captions/actions/segments/ShiftSegmentsTimeAction';
import { SegmentHardTime } from '@core/captions/services/SegmentHardTime';
import { SegmentTimeBounds } from '@core/captions/services/SegmentTimeBounds';

const ALIGNMENT: AlignmentConfig = {
  verticalAlign: 'bottom',
  verticalOffset: 0,
  horizontalAlign: 'center',
  horizontalOffset: 0,
};

function sheetWith(id: string): Sheet {
  const template = new Template(
    { id: 'plain', category: 'lab' } as unknown as TemplateMetadata,
    TYPOGRAPHY_DEFAULTS,
    ROTATION_DEFAULTS,
    ALIGNMENT,
    {} as RenderingConfig,
    {} as FeaturesConfig,
    {} as BehindActorTemplateConfig,
    [],
    [],
    { type: 'isolated-word', minLetters: 4, minSecondsOnScreen: 0.8 },
    [],
    [],
    {} as SvgFilterDefinitions,
    '',
    '',
    [],
  );
  return Sheet.fromTemplate(id, id, null, template, 'ltr');
}

/** A segment saying one word per `[start, end]` pair, in order. */
function segmentSaying(...times: Array<[number, number]>): Segment {
  const words = times.map(([start, end], index) => new Word({ text: `w${index}`, time: new TimeFragment(start, end) }));
  return new Segment({ lines: [new Line({ words })] });
}

const VIDEO_SEC = 10;

function storeWith(sections: Section[], sheets: Sheet[]): EditorStore {
  const store = new EditorStore();
  store.patch({
    document: new Document({ sections }),
    sheets,
    activeSheetId: sheets[0]!.id,
    video: { layout: { width: 1080, height: 1920 }, duration: VIDEO_SEC },
  });
  return store;
}

function plainStore(segments: Segment[]): EditorStore {
  return storeWith([new Section({ kind: 'plain', segments })], [sheetWith('plain')]);
}

const deriver = new DocumentDeriver(
  [],
  new SegmentSplitterRegistry(),
  new LineSplitterRegistry(),
  new EffectRegistry(),
  { build: () => ({}) } as unknown as SheetCssVarsBuilder,
  new DecorationTimeResolver(),
  new InlineEmojiPunctuationAbsorber(),
);

function actionOn(store: EditorStore): ShiftSegmentsTimeAction {
  return new ShiftSegmentsTimeAction(store, deriver, new SegmentTimeBounds(new SegmentHardTime()));
}

function segmentOf(store: EditorStore, id: string): Segment {
  return store.snapshot().document!.getSegments().find((segment) => segment.id === id)!;
}

function wordTimes(segment: Segment): Array<[number, number]> {
  return segment.getWords().map((word) => [word.time.start, word.time.end]);
}

describe('ShiftSegmentsTimeAction', () => {
  it('moves every word of the segment by the same distance', () => {
    const moved = segmentSaying([1, 1.5], [1.5, 2.25]);
    const store = plainStore([moved]);

    actionOn(store).execute({ segmentIds: [moved.id], deltaSec: 2 });

    expect(wordTimes(segmentOf(store, moved.id))).toEqual([[3, 3.5], [3.5, 4.25]]);
  });

  it('moves a named window along with the words', () => {
    const moved = segmentSaying([1, 2]).with({ customTime: new TimeFragment(0.5, 2.5) });
    const store = plainStore([moved]);

    actionOn(store).execute({ segmentIds: [moved.id], deltaSec: 1 });

    expect(segmentOf(store, moved.id).customTime).toEqual(new TimeFragment(1.5, 3.5));
  });

  it('moves a window an effect computed along with the words', () => {
    const moved = segmentSaying([1, 2]).with({ effectTime: new TimeFragment(1, 2.5) });
    const store = plainStore([moved]);

    actionOn(store).execute({ segmentIds: [moved.id], deltaSec: -0.5 });

    expect(segmentOf(store, moved.id).time).toEqual(new TimeFragment(0.5, 2));
  });

  it('stops flush against a neighbour on the same sheet', () => {
    const moved = segmentSaying([1, 2]);
    const neighbour = segmentSaying([4, 5]);
    const store = plainStore([moved, neighbour]);

    actionOn(store).execute({ segmentIds: [moved.id], deltaSec: 5 });

    expect(wordTimes(segmentOf(store, moved.id))).toEqual([[3, 4]]);
    expect(wordTimes(segmentOf(store, neighbour.id))).toEqual([[4, 5]]);
  });

  it('stops at the start and at the end of the video', () => {
    const early = segmentSaying([1, 2]);
    const late = segmentSaying([8, 9]);

    const backwards = plainStore([early]);
    actionOn(backwards).execute({ segmentIds: [early.id], deltaSec: -5 });
    expect(wordTimes(segmentOf(backwards, early.id))).toEqual([[0, 1]]);

    const forwards = plainStore([late]);
    actionOn(forwards).execute({ segmentIds: [late.id], deltaSec: 5 });
    expect(wordTimes(segmentOf(forwards, late.id))).toEqual([[9, 10]]);
  });

  it('lets segments moving together pass where each alone would stop', () => {
    const first = segmentSaying([1, 2]);
    const second = segmentSaying([2, 3]);
    const store = plainStore([first, second]);

    actionOn(store).execute({ segmentIds: [first.id, second.id], deltaSec: 4 });

    expect(wordTimes(segmentOf(store, first.id))).toEqual([[5, 6]]);
    expect(wordTimes(segmentOf(store, second.id))).toEqual([[6, 7]]);
  });

  it('is not stopped by a segment on another sheet', () => {
    const moved = segmentSaying([1, 2]);
    const parallel = segmentSaying([3, 4]);
    const store = storeWith(
      [new Section({ kind: 'plain', segments: [moved] }), new Section({ kind: 'other', segments: [parallel] })],
      [sheetWith('plain'), sheetWith('other')],
    );

    actionOn(store).execute({ segmentIds: [moved.id], deltaSec: 2 });

    expect(wordTimes(segmentOf(store, moved.id))).toEqual([[3, 4]]);
  });

  it('does not freeze the segment it moves', () => {
    const moved = segmentSaying([1, 2]);
    const store = plainStore([moved]);

    actionOn(store).execute({ segmentIds: [moved.id], deltaSec: 1 });

    expect(store.snapshot().frozenSegments.has(moved.id)).toBe(false);
  });
});
