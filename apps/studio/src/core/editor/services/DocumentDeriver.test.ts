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
import { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import { EffectRegistry } from '@core/effect/services/EffectRegistry';
import { DecorationTimeResolver } from '@core/effect/services/DecorationTimeResolver';
import { InlineEmojiPunctuationAbsorber } from '@core/effect/services/InlineEmojiPunctuationAbsorber';
import { SegmentSplitterRegistry } from '@core/segment-splitter/services/SegmentSplitterRegistry';
import { LineSplitterRegistry } from '@core/line-splitter/services/LineSplitterRegistry';
import type { SheetCssVarsBuilder } from '@core/sheets/services/SheetCssVarsBuilder';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import { Template } from '@core/templates/domain/Template';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import { Sheet } from '@core/sheets/domain/Sheet';
import { FrozenSegmentSet } from '@core/captions/domain/FrozenSegmentSet';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';

const ALIGNMENT: AlignmentConfig = {
  verticalAlign: 'bottom',
  verticalOffset: 0,
  horizontalAlign: 'center',
  horizontalOffset: 0,
};

function templateWith(lineSplitter: LineSplitterConfig, effects: readonly EffectConfig[]): Template {
  return new Template(
    { id: 'plain', category: 'lab' } as unknown as TemplateMetadata,
    TYPOGRAPHY_DEFAULTS,
    ROTATION_DEFAULTS,
    ALIGNMENT,
    {} as RenderingConfig,
    {} as FeaturesConfig,
    {} as BehindActorTemplateConfig,
    effects,
    [],
    lineSplitter,
    [],
    [],
    {} as SvgFilterDefinitions,
    '',
    '',
    [],
  );
}

// A caption held up to a second after its last word, lifting a word that
// stays on screen for 0.8s.
const isolating = Sheet.fromTemplate('isolating', 'Isolating', null, templateWith(
  { type: 'isolated-word', minLetters: 4, minSecondsOnScreen: 0.8 },
  [{ type: 'gap_free', enabled: true }],
), 'ltr');
const other = Sheet.fromTemplate('other', 'Other', null, templateWith(
  { type: 'isolated-word', minLetters: 4, minSecondsOnScreen: 0.8 },
  [],
), 'ltr');

function deriver(): DocumentDeriver {
  return new DocumentDeriver(
    [],
    new SegmentSplitterRegistry(),
    new LineSplitterRegistry(),
    new EffectRegistry(),
    { build: () => ({}) } as unknown as SheetCssVarsBuilder,
    new DecorationTimeResolver(),
    new InlineEmojiPunctuationAbsorber(),
  );
}

function segment(words: ReadonlyArray<[text: string, start: number, end: number]>): Segment {
  return new Segment({
    lines: [new Line({ words: words.map(([text, start, end]) => new Word({ text, time: new TimeFragment(start, end) })) })],
  });
}

// "legoland" is said at 0.3s. Held a second after its caption's last word
// it would stay on screen long enough; cut at 0.9s it would not.
const legoland = (): Segment => segment([['i', 0, 0.1], ['am', 0.1, 0.2], ['at', 0.2, 0.3], ['legoland', 0.3, 0.9]]);

function derive(sections: Section[], frozenSegments = FrozenSegmentSet.empty()): Document {
  return deriver().derive(new Document({ sections }), [isolating, other], {
    videoWidth: 1080,
    videoHeight: 1920,
    videoDurationSeconds: 10,
    frozenSegments,
    decorationOverrides: DecorationOverrideRegistry.empty(),
  });
}

function linesOfFirstSegment(document: Document): string[] {
  return document.sections[0]!.segments[0]!.lines.map((line) => line.getText());
}

describe('DocumentDeriver', () => {
  it('counts a caption as held when nothing follows it', () => {
    const derived = derive([new Section({ kind: 'isolating', segments: [legoland()] })]);

    expect(linesOfFirstSegment(derived)).toEqual(['i am at', 'legoland']);
  });

  it('cuts a caption short where the next section starts, whatever sheet it belongs to', () => {
    const derived = derive([
      new Section({ kind: 'isolating', segments: [legoland()] }),
      new Section({ kind: 'other', segments: [segment([['next', 0.9, 1.5]])] }),
    ]);

    expect(linesOfFirstSegment(derived)).toEqual(['i am at legoland']);
  });

  it('cuts a caption short where a frozen segment after it starts', () => {
    const frozen = segment([['next', 0.9, 1.5]]);
    const derived = derive(
      [new Section({ kind: 'isolating', segments: [legoland(), frozen] })],
      FrozenSegmentSet.fromSnapshot([frozen.id]),
    );

    expect(linesOfFirstSegment(derived)).toEqual(['i am at legoland']);
  });
});
