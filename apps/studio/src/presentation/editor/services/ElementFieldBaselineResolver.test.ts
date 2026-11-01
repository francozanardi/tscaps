import { describe, expect, it } from 'vitest';
import type { AlignmentConfig, SvgFilterDefinitions } from '@tscaps/engine';
import { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldLibrary } from '@core/elements/domain/fields/ElementFieldLibrary';
import { FontFamilyField } from '@core/elements/domain/fields/FontFamilyField';
import { FontSizeField } from '@core/elements/domain/fields/FontSizeField';
import { FontWeightField } from '@core/elements/domain/fields/FontWeightField';
import { ItalicField } from '@core/elements/domain/fields/ItalicField';
import { RelativeSizeField } from '@core/elements/domain/fields/RelativeSizeField';
import { RotationField } from '@core/elements/domain/fields/RotationField';
import { StrikethroughField } from '@core/elements/domain/fields/StrikethroughField';
import { TextColorField } from '@core/elements/domain/fields/TextColorField';
import { UnderlineField } from '@core/elements/domain/fields/UnderlineField';
import { DecorationElementType } from '@core/elements/domain/types/DecorationElementType';
import { LineElementType } from '@core/elements/domain/types/LineElementType';
import { SegmentElementType } from '@core/elements/domain/types/SegmentElementType';
import { WordElementType } from '@core/elements/domain/types/WordElementType';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { Sheet } from '@core/sheets/domain/Sheet';
import { StyleValues } from '@core/sheets/domain/StyleValues';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import { Template } from '@core/templates/domain/Template';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import { ElementFieldBaselineResolver } from '@presentation/editor/services/ElementFieldBaselineResolver';
import { RestingElementStyle } from '@presentation/editor/services/RestingElementStyle';
import { RestingStyleFieldReader } from '@presentation/editor/services/RestingStyleFieldReader';

/**
 * What a word's fields open on while it has been told nothing.
 *
 * A word a template makes bold for its tag opened on the sheet's plain
 * weight, because the answer came from the sheet's typography alone.
 * The browser's reading of the word at rest now comes first; the sheet
 * is what is left for a field that cannot read one back, and for a word
 * the browser was not asked about. The values below stand for what the
 * browser computes, in the form it computes them: that a real page
 * produces them is the probe's own test.
 */

const ALIGNMENT: AlignmentConfig = { verticalAlign: 'bottom', verticalOffset: 0, horizontalAlign: 'left', horizontalOffset: 0 };

const template = new Template(
  { id: 'plain', name: 'Plain', category: 'lab' } as unknown as TemplateMetadata,
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

const sheet = new Sheet({
  id: 'main',
  name: 'Main',
  color: null,
  template,
  variantIndex: 0,
  styleValues: StyleValues.fromTemplateVariant(template, 0),
  typographyConfig: { ...TYPOGRAPHY_DEFAULTS, fontWeight: 600 },
  rotationConfig: ROTATION_DEFAULTS,
  segmentSplitterConfigs: [],
  lineSplitterConfig: { mode: 'none' } as unknown as LineSplitterConfig,
  alignmentConfig: ALIGNMENT,
  effectConfigs: [],
});

const fields = new ElementFieldLibrary([
  new ItalicField(),
  new UnderlineField(),
  new StrikethroughField(),
  new FontFamilyField(),
  new FontSizeField(),
  new RelativeSizeField(),
  new FontWeightField(),
  new TextColorField(),
  new RotationField(),
]);

const resolver = new ElementFieldBaselineResolver(
  new StyledElementCatalog({
    segment: new SegmentElementType(fields),
    line: new LineElementType(fields),
    word: new WordElementType(fields),
    decoration: new DecorationElementType(fields),
  }),
  new RestingStyleFieldReader(),
);

/** An emphasised word in a template that draws emphasis at 900, as Chromium computes it. */
const emphasisedAtRest = new RestingElementStyle(
  new Map([
    ['font-weight', '900'],
    ['font-style', 'normal'],
    ['text-decoration-line', 'none'],
    ['color', 'rgb(230, 214, 71)'],
    ['font-size', '76.8px'],
    ['rotate', 'none'],
  ]),
  new Map([['font-size', '64px']]),
);

describe('a word the browser was asked about', () => {
  it('opens on what the browser resolves for it rather than on the sheet\'s typography', () => {
    const baseline = resolver.resolve('word', sheet, [null, null], emphasisedAtRest);

    expect(baseline[ElementFieldId.FONT_WEIGHT]).toBe(900);
    expect(baseline[ElementFieldId.PRIMARY_COLOR]).toBe('#e6d647');
    expect(baseline[ElementFieldId.RELATIVE_SIZE]).toBe(120);
  });

  it('keeps the sheet\'s answer for the font, which cannot be read back', () => {
    const baseline = resolver.resolve('word', sheet, [null, null], emphasisedAtRest);

    expect(baseline[ElementFieldId.FONT_FAMILY]).toEqual(TYPOGRAPHY_DEFAULTS.fontStack.toSnapshot());
  });
});

describe('a word the browser was not asked about', () => {
  it('opens on the sheet\'s typography', () => {
    const baseline = resolver.resolve('word', sheet, [null, null], null);

    expect(baseline[ElementFieldId.FONT_WEIGHT]).toBe(600);
  });
});
