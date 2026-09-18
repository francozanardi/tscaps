import { describe, expect, it } from 'vitest';
import { Decoration, Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { ELEMENT_KINDS, type ElementKind } from '@core/elements/domain/ElementKind';
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
import { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import { DecorationElementType } from '@core/elements/domain/types/DecorationElementType';
import { LineElementType } from '@core/elements/domain/types/LineElementType';
import { SegmentElementType } from '@core/elements/domain/types/SegmentElementType';
import { WordElementType } from '@core/elements/domain/types/WordElementType';
import { CaptionScripts } from '@core/fonts/domain/CaptionScripts';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { CaptionFontOverridesBuilder } from '@core/fonts/services/CaptionFontOverridesBuilder';
import { CompiledFamilyNamer } from '@core/fonts/services/CompiledFamilyNamer';
import { DrawableFamilyResolver } from '@core/fonts/services/DrawableFamilyResolver';
import { FontStackResolver } from '@core/fonts/services/FontStackResolver';
import { SegmentFontStylesBuilder } from '@core/fonts/services/SegmentFontStylesBuilder';

/**
 * A font chosen on an element reaches what draws only through this
 * layer: the element's own CSS spells nothing, so an element offering
 * the field and receiving no override here keeps whatever the sheet
 * gave it, silently.
 *
 * That is what happened to a line, which offered the field from the day
 * it was written and had no layer in either path.
 */

const library = new FontStackLibrary();
const builder = new CaptionFontOverridesBuilder(new SegmentFontStylesBuilder(
  new FontStackResolver(new CompiledFamilyNamer(), new DrawableFamilyResolver()),
));

const fieldLibrary = new ElementFieldLibrary([
  new ItalicField(), new UnderlineField(), new StrikethroughField(), new FontFamilyField(),
  new FontSizeField(), new RelativeSizeField(), new FontWeightField(), new TextColorField(),
  new RotationField(),
]);
const catalog = new StyledElementCatalog({
  segment: new SegmentElementType(fieldLibrary),
  line: new LineElementType(fieldLibrary),
  word: new WordElementType(fieldLibrary),
  decoration: new DecorationElementType(fieldLibrary),
});

const ID_BY_KIND: Readonly<Record<ElementKind, string>> = {
  segment: 'seg1', line: 'l1', word: 'w1', decoration: 'w1:d',
};

const SHEET = {
  id: 'main',
  scripts: new CaptionScripts('latin', new Set(['latin', 'cyrillic'])),
  typographyConfig: { ...TYPOGRAPHY_DEFAULTS, fontStack: library.stackFor('anton') },
} as unknown as Sheet;

const DOCUMENT = new Document({
  sections: [new Section({
    kind: 'main',
    segments: [new Segment({
      id: ID_BY_KIND.segment,
      lines: [new Line({
        id: ID_BY_KIND.line,
        words: [new Word({
          id: ID_BY_KIND.word,
          text: 'hola',
          time: new TimeFragment(0, 1),
          decoration: new Decoration({ id: ID_BY_KIND.decoration, glyph: '🎉' }),
        })],
      })],
    })],
  })],
});

function stylesGivingFontTo(kind: ElementKind): ElementStyles {
  return ElementStyles.fromSnapshot({
    [ID_BY_KIND[kind]]: {
      kind,
      css: '',
      fields: { [ElementFieldId.FONT_FAMILY]: library.stackFor('lora').toSnapshot() },
    },
  } as never);
}

describe('every element that can be given a font of its own', () => {
  const offering = ELEMENT_KINDS.filter(
    (kind) => catalog.controlFor(kind, ElementFieldId.FONT_FAMILY) !== null,
  );

  it('is a set the catalog decides, not this test', () => {
    expect(offering).toEqual(['segment', 'line', 'word']);
  });

  it.each(offering)('has the family its stack compiles to layered over it: %s', (kind) => {
    const overrides = builder.build(DOCUMENT, [SHEET], stylesGivingFontTo(kind));
    const declared = kind === 'segment'
      ? overrides.segmentsBySheet['main']?.get(ID_BY_KIND[kind])
      : overrides.subtreeBySheet['main']?.get(ID_BY_KIND[kind]);
    expect(Object.values(declared?.inlineStyles ?? {}).join()).toContain('tscaps-');
  });
});
