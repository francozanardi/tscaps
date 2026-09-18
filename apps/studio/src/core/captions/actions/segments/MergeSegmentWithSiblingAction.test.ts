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
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import { Template } from '@core/templates/domain/Template';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import { MAIN_SHEET_ID, Sheet } from '@core/sheets/domain/Sheet';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';
import { CharOwnership } from '@core/captions/domain/CharOwnership';
import { MergeSegmentWithSiblingAction } from '@core/captions/actions/segments/MergeSegmentWithSiblingAction';

const ALIGNMENT: AlignmentConfig = {
  verticalAlign: 'bottom',
  verticalOffset: 0,
  horizontalAlign: 'center',
  horizontalOffset: 0,
};

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
  { mode: 'none' } as unknown as LineSplitterConfig,
  [],
  [],
  {} as SvgFilterDefinitions,
  '',
  '',
  [],
);

const VIDEO_DURATION_SEC = 12;

function deriver(): DocumentDeriver {
  return new DocumentDeriver(
    [],
    new SegmentSplitterRegistry(),
    new LineSplitterRegistry(),
    new EffectRegistry(),
    {} as SheetCssVarsBuilder,
    new DecorationTimeResolver(),
    new InlineEmojiPunctuationAbsorber(),
  );
}

function createAction(store: EditorStore): MergeSegmentWithSiblingAction {
  return new MergeSegmentWithSiblingAction(
    store,
    deriver(),
    () => VIDEO_DURATION_SEC,
  );
}

function makeSegment(text: string, start: number, end: number): Segment {
  return new Segment({
    lines: [
      new Line({
        words: [new Word({ text, time: new TimeFragment(start, end) })],
      }),
    ],
  });
}

function createStore(segments: Segment[], cuts = CutRegistry.empty()): EditorStore {
  const store = new EditorStore();
  const main = Sheet.createMain(template);
  store.patch({
    document: new Document({
      sections: [new Section({ segments, kind: MAIN_SHEET_ID })],
    }),
    sheets: [main],
    activeSheetId: MAIN_SHEET_ID,
    video: { duration: VIDEO_DURATION_SEC, isReady: true },
    cuts,
  });
  return store;
}

describe('MergeSegmentWithSiblingAction', () => {
  it('merges with previous sibling on direction "prev"', () => {
    const seg1 = makeSegment('hello', 0, 2);
    const seg2 = makeSegment('world', 2, 4);
    const store = createStore([seg1, seg2]);
    const action = createAction(store);

    const { text, ownership } = CharOwnership.fromSegment(seg2);
    action.execute({
      segmentId: seg2.id,
      text,
      ownership,
      direction: 'prev',
    });

    const segments = store.snapshot().document!.getSegments();
    expect(segments).toHaveLength(1);
    expect(segments[0]!.id).toBe(seg1.id);
    expect(segments[0]!.getText()).toBe('hello world');
  });

  it('merges with next sibling on direction "next"', () => {
    const seg1 = makeSegment('hello', 0, 2);
    const seg2 = makeSegment('world', 2, 4);
    const store = createStore([seg1, seg2]);
    const action = createAction(store);

    const { text, ownership } = CharOwnership.fromSegment(seg1);
    action.execute({
      segmentId: seg1.id,
      text,
      ownership,
      direction: 'next',
    });

    const segments = store.snapshot().document!.getSegments();
    expect(segments).toHaveLength(1);
    expect(segments[0]!.id).toBe(seg1.id);
    expect(segments[0]!.getText()).toBe('hello world');
  });

  it('merges with visible previous sibling skipping cut segments in between', () => {
    const seg1 = makeSegment('visible-one', 0, 2);
    const segCut = makeSegment('cut-segment', 3, 4);
    const seg2 = makeSegment('visible-two', 6, 8);
    const cuts = CutRegistry.empty().add({ startSec: 2.5, endSec: 5.5 });
    const store = createStore([seg1, segCut, seg2], cuts);
    const action = createAction(store);

    const { text, ownership } = CharOwnership.fromSegment(seg2);
    action.execute({
      segmentId: seg2.id,
      text,
      ownership,
      direction: 'prev',
    });

    const segments = store.snapshot().document!.getSegments();
    // seg1 merged with seg2, segCut preserved in the document
    expect(segments).toHaveLength(2);
    expect(segments[0]!.id).toBe(seg1.id);
    expect(segments[0]!.getText()).toBe('visible-one visible-two');
    expect(segments[1]!.id).toBe(segCut.id);
    expect(segments[1]!.getText()).toBe('cut-segment');
  });

  it('no-ops when direction is "prev" on the first visible segment even if cut segments precede it', () => {
    const segCut = makeSegment('cut-first', 0, 2);
    const seg1 = makeSegment('visible-first', 4, 6);
    const cuts = CutRegistry.empty().add({ startSec: 0, endSec: 3 });
    const store = createStore([segCut, seg1], cuts);
    const action = createAction(store);

    const { text, ownership } = CharOwnership.fromSegment(seg1);
    action.execute({
      segmentId: seg1.id,
      text,
      ownership,
      direction: 'prev',
    });

    const segments = store.snapshot().document!.getSegments();
    expect(segments).toHaveLength(2);
    expect(segments[0]!.id).toBe(segCut.id);
    expect(segments[1]!.id).toBe(seg1.id);
  });

  it('no-ops when direction is "next" on the last visible segment even if cut segments follow it', () => {
    const seg1 = makeSegment('visible-last', 1, 3);
    const segCut = makeSegment('cut-last', 6, 8);
    const cuts = CutRegistry.empty().add({ startSec: 5, endSec: 10 });
    const store = createStore([seg1, segCut], cuts);
    const action = createAction(store);

    const { text, ownership } = CharOwnership.fromSegment(seg1);
    action.execute({
      segmentId: seg1.id,
      text,
      ownership,
      direction: 'next',
    });

    const segments = store.snapshot().document!.getSegments();
    expect(segments).toHaveLength(2);
    expect(segments[0]!.id).toBe(seg1.id);
    expect(segments[1]!.id).toBe(segCut.id);
  });
});
