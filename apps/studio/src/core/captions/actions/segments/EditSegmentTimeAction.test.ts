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
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import { Template } from '@core/templates/domain/Template';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import { Sheet } from '@core/sheets/domain/Sheet';
import { EditSegmentTimeAction } from '@core/captions/actions/segments/EditSegmentTimeAction';
import { SegmentHardTime } from '@core/captions/services/SegmentHardTime';
import { SegmentTimeBounds } from '@core/captions/services/SegmentTimeBounds';

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

function segmentSaid(text: string, start: number, end: number): Segment {
  return new Segment({ lines: [new Line({ words: [new Word({ text, time: new TimeFragment(start, end) })] })] });
}

const sheets = [sheetWith('plain', [])];

function storeWith(segments: Segment[]): EditorStore {
  const store = new EditorStore();
  store.patch({
    document: new Document({ sections: [new Section({ kind: 'plain', segments })] }),
    sheets,
    activeSheetId: 'plain',
    video: { layout: { width: 1080, height: 1920 }, duration: 10 },
  });
  return store;
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

function rederive(store: EditorStore): Document {
  const { document, frozenSegments, decorationOverrides } = store.snapshot();
  return deriver.derive(document!, sheets, {
    videoWidth: 1080,
    videoHeight: 1920,
    videoDurationSeconds: 10,
    frozenSegments,
    decorationOverrides,
  });
}

describe('EditSegmentTimeAction', () => {
  it('keeps the window it sets through a later derivation', () => {
    const edited = segmentSaid('hello', 0, 1);
    const store = storeWith([edited, segmentSaid('later', 5, 6)]);
    const action = new EditSegmentTimeAction(store, deriver, new SegmentTimeBounds(new SegmentHardTime()));

    action.execute({ segmentId: edited.id, start: 0, end: 3 });

    const kept = rederive(store).getSegments().find((segment) => segment.id === edited.id);
    expect(kept?.customTime).toEqual(new TimeFragment(0, 3));
  });
});
