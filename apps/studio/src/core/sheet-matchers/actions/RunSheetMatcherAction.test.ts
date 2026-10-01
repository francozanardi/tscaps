import { describe, expect, it } from 'vitest';
import {
  Document,
  Line,
  Section,
  Segment,
  Tag,
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
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import { Template } from '@core/templates/domain/Template';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import { Sheet } from '@core/sheets/domain/Sheet';
import { RunSheetMatcherAction } from '@core/sheet-matchers/actions/RunSheetMatcherAction';
import { SelectedSegmentSheetMatcher } from '@core/sheet-matchers/services/SelectedSegmentSheetMatcher';
import { TagSheetMatcher } from '@core/sheet-matchers/services/TagSheetMatcher';

const ALIGNMENT: AlignmentConfig = {
  verticalAlign: 'bottom',
  verticalOffset: 0,
  horizontalAlign: 'center',
  horizontalOffset: 0,
};

function sheetWith(id: string, effects: readonly EffectConfig[]): Sheet {
  const template = new Template(
    { id: 'plain', category: 'lab' } as unknown as TemplateMetadata,
    TYPOGRAPHY_DEFAULTS,
    ROTATION_DEFAULTS,
    ALIGNMENT,
    {} as RenderingConfig,
    {} as FeaturesConfig,
    {} as BehindActorTemplateConfig,
    effects,
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

function segmentSaid(text: string, start: number, end: number, tagName?: string): Segment {
  const semanticTags = tagName === undefined ? undefined : new Set([Tag.of(tagName)]);
  return new Segment({ lines: [new Line({ words: [new Word({ text, time: new TimeFragment(start, end), semanticTags })] })] });
}

function storeWith(segments: Segment[]): EditorStore {
  const store = new EditorStore();
  store.patch({
    document: new Document({ sections: [new Section({ kind: 'plain', segments })] }),
    sheets: [sheetWith('plain', []), sheetWith('held', [{ type: 'gap_free', enabled: true }])],
    activeSheetId: 'plain',
    video: { layout: { width: 1080, height: 1920 }, duration: 10 },
  });
  return store;
}

function action(store: EditorStore): RunSheetMatcherAction {
  const deriver = new DocumentDeriver(
    [],
    new SegmentSplitterRegistry(),
    new LineSplitterRegistry(),
    new EffectRegistry(),
    { build: () => ({}) } as unknown as SheetCssVarsBuilder,
    new DecorationTimeResolver(),
    new InlineEmojiPunctuationAbsorber(),
  );
  return new RunSheetMatcherAction(store, deriver);
}

function firstSegmentOfSheet(store: EditorStore, sheetId: string): Segment {
  return store.snapshot().document!.sections.find((section) => section.kind === sheetId)!.segments[0]!;
}

describe('RunSheetMatcherAction', () => {
  it('shapes a matched segment\'s time under the effects of the sheet it moves to', () => {
    const moved = segmentSaid('hello', 0, 1);
    const store = storeWith([moved, segmentSaid('later', 5, 6)]);

    action(store).execute('held', new SelectedSegmentSheetMatcher(), new Set([moved.id]));

    expect(firstSegmentOfSheet(store, 'held').time.end).toBe(2);
  });

  it('shapes the time of matched words under the effects of the sheet they move to', () => {
    const store = storeWith([segmentSaid('hello', 0, 1, 'emphasis'), segmentSaid('later', 5, 6)]);

    action(store).execute('held', new TagSheetMatcher(), { tagName: 'emphasis' });

    expect(firstSegmentOfSheet(store, 'held').time.end).toBe(2);
  });
});
