import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, SvgFilterDefinitions, TimeFragment, Word, type AlignmentConfig } from '@tscaps/engine';
import { BuiltinAssetRepository } from '@core/assets/infrastructure/repositories/BuiltinAssetRepository';
import type { ElementPlacement } from '@core/elements/domain/ElementPlacement';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { Sheet } from '@core/sheets/domain/Sheet';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import { Template } from '@core/templates/domain/Template';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { RenderingConfig, VideoFramePreviewMode } from '@core/templates/domain/definition/RenderingConfig';
import { bootRendering } from '@bootstrap/wiring/rendering';
import { BehindActorSegmentClassResolver } from '@presentation/editor/services/BehindActorSegmentClassResolver';
import { OverlayRestingCaptionSource } from '@presentation/editor/services/OverlayRestingCaptionSource';
import type { CaptionPaintState } from '@presentation/editor/services/RestingCaptionProbe';
import { SheetOverlayArtifactsBuilder } from '@presentation/editor/services/SheetOverlayArtifactsBuilder';

/**
 * How a word's caption is dressed before it is copied for the probe:
 * with the overlay's own reasons for painting it the way it does.
 *
 * Each of these is something the overlay paints from beyond the
 * caption's words, and leaving one out made the copy describe a
 * different caption from the one on screen: a placed word read as if it
 * were still in its line, a caption behind the actor read in front of
 * it.
 */

const ALIGNMENT: AlignmentConfig = { verticalAlign: 'bottom', verticalOffset: 0, horizontalAlign: 'left', horizontalOffset: 0 };
const PLACEMENT: ElementPlacement = { verticalAlign: 'top', verticalOffset: 0.2, horizontalAlign: 'left', horizontalOffset: 0.3 };

function sheetWithVideoFrame(required: boolean, previewMode: VideoFramePreviewMode): Sheet {
  const rendering = { splitWordsIntoLetters: false, videoFrame: { required, jpegQuality: 0.7, previewMode } } as unknown as RenderingConfig;
  const template = new Template(
    { id: 'plain', name: 'Plain', category: 'lab' } as unknown as TemplateMetadata,
    TYPOGRAPHY_DEFAULTS,
    ROTATION_DEFAULTS,
    ALIGNMENT,
    rendering,
    {} as FeaturesConfig,
    {} as BehindActorTemplateConfig,
    [],
    [],
    { mode: 'none' } as unknown as LineSplitterConfig,
    [],
    [],
    SvgFilterDefinitions.empty(),
    '',
    '',
    [],
  );
  return Sheet.fromTemplate('main', 'Main', null, template, 'ltr');
}

const SHEET = sheetWithVideoFrame(false, 'omit');

const rendering = bootRendering({
  assetLibrary: { repository: new BuiltinAssetRepository([]) } as never,
  fontFaceCssReader: {} as never,
  fontMetricsReader: {} as never,
});

const source = new OverlayRestingCaptionSource(
  new SheetOverlayArtifactsBuilder(
    rendering.sheetCssVarsBuilder,
    rendering.svgFilterDefinitionsResolver,
    rendering.segmentPaddingCssRuleBuilder,
    rendering.layeredCaptionCssBuilder,
  ),
  rendering.segmentColorRotation,
  new BehindActorSegmentClassResolver(),
);

function word(id: string, start: number): Word {
  return new Word({ id, text: id, time: new TimeFragment(start, start + 1) });
}

const DOCUMENT = new Document({
  sections: [new Section({
    kind: 'main',
    segments: [
      new Segment({ id: 's0', lines: [new Line({ id: 'l0', words: [word('w0', 0), word('w1', 1), word('w2', 2)] })] }),
      new Segment({ id: 's1', lines: [new Line({ id: 'l1', words: [word('w3', 3)] })] }),
    ],
  })],
});

function paintState(overrides: Partial<CaptionPaintState> = {}): CaptionPaintState {
  return {
    document: DOCUMENT,
    elementStyles: ElementStyles.empty(),
    behindActorSegmentIds: new Set(),
    behindActorElementIds: new Set(),
    ...overrides,
  };
}

describe('a word placed out of its line', () => {
  it('is the one word of its caption the overlay paints alone', () => {
    const elementStyles = ElementStyles.empty().withPlacement('w1', 'word', PLACEMENT);

    const caption = source.captionOf(paintState({ elementStyles }), SHEET, 'w0');

    expect([...caption!.positionedWordIds]).toEqual(['w1']);
  });
});

describe('a caption the text-behind-actor effect reaches', () => {
  it('carries the class for a caption behind the actor whole', () => {
    const caption = source.captionOf(paintState({ behindActorSegmentIds: new Set(['s0']) }), SHEET, 'w0');

    expect(caption!.segmentStateClasses).toEqual(['behind-actor-active']);
  });

  it('carries the class for a caption with only some of its words behind the actor', () => {
    const caption = source.captionOf(paintState({ behindActorElementIds: new Set(['w2']) }), SHEET, 'w0');

    expect(caption!.segmentStateClasses).toEqual(['behind-actor-partial']);
  });

  it('carries no class for a caption the effect does not reach', () => {
    const caption = source.captionOf(paintState({ behindActorElementIds: new Set(['w2']) }), SHEET, 'w3');

    expect(caption!.segmentStateClasses).toEqual([]);
  });
});

describe('the video frame layer', () => {
  it('is in the copy of a template the preview paints it live for', () => {
    const caption = source.captionOf(paintState(), sheetWithVideoFrame(true, 'live'), 'w0');

    expect(caption!.includeVideoFrameLayer).toBe(true);
  });

  it('is not in the copy of a template whose preview omits it', () => {
    const caption = source.captionOf(paintState(), sheetWithVideoFrame(true, 'omit'), 'w0');

    expect(caption!.includeVideoFrameLayer).toBe(false);
  });
});
