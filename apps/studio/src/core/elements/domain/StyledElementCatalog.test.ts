import { describe, expect, it } from 'vitest';
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
import { LayerElementType } from '@core/elements/domain/types/LayerElementType';
import { LineElementType } from '@core/elements/domain/types/LineElementType';
import { SegmentElementType } from '@core/elements/domain/types/SegmentElementType';
import { WordElementType } from '@core/elements/domain/types/WordElementType';

/**
 * What each kind of element offers, and how it gets there.
 *
 * The shape this replaced kept the two answers in separate tables that
 * nothing forced to agree, so a field could end up offered under one
 * name on a word and another on a segment, or with bounds that differed
 * for no reason. Those are the two things pinned here.
 */

const library = new ElementFieldLibrary([
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

const catalog = new StyledElementCatalog({
  segment: new SegmentElementType(library),
  line: new LineElementType(library),
  word: new WordElementType(library),
  decoration: new DecorationElementType(library),
  layer: new LayerElementType(library),
});

describe('a field offered by more than one kind of element', () => {
  it('keeps its dial wherever it appears, and differs only in the property it writes', () => {
    const shared = catalog.controlsFor('word').filter((control) => catalog.controlFor('segment', control.id as ElementFieldId) !== null);
    expect(shared.map((control) => control.id)).toEqual([
      'italic', 'underline', 'strikethrough', 'font-family', 'font-weight', 'primary-color', 'rotation',
    ]);
    for (const onAWord of shared) {
      const { property: _wordProperty, ...wordDial } = onAWord;
      const { property: _segmentProperty, ...segmentDial } = catalog.controlFor('segment', onAWord.id as ElementFieldId)!;
      expect(segmentDial).toEqual(wordDial);
    }
  });

  // Size is the one thing a word and a caption do not share, and the
  // difference is not how the value gets there: a caption is a share of
  // the frame, a word is a ratio to the words beside it. Two quantities,
  // so two fields — one dial that meant both would have to lie on one.
  it('does not include a size', () => {
    expect(catalog.controlFor('word', ElementFieldId.FONT_SIZE)).toBeNull();
    expect(catalog.controlFor('segment', ElementFieldId.RELATIVE_SIZE)).toBeNull();
    expect(catalog.controlFor('word', ElementFieldId.RELATIVE_SIZE)?.unit).toBe('%');
    expect(catalog.controlFor('segment', ElementFieldId.FONT_SIZE)?.unit).toBe('cqh');
  });
});

describe('how a kind of element reaches the style', () => {
  it('declares the property when it is the text', () => {
    expect(catalog.controlFor('word', ElementFieldId.PRIMARY_COLOR)?.property).toBe('color');
  });

  // A declaration on a descendant beats anything inherited from an
  // ancestor, so a wrapper setting `color` would be ignored by the very
  // words it is trying to paint.
  it('goes through the template variable when it wraps the text', () => {
    expect(catalog.controlFor('segment', ElementFieldId.PRIMARY_COLOR)?.property).toBe('--tscaps-primary-color');
  });
});

describe('a glyph riding a word', () => {
  it('offers only what means something on an emoji', () => {
    expect(catalog.controlsFor('decoration').map((control) => control.id)).toEqual(['relative-size', 'rotation']);
  });

  // The baseline already sizes a glyph at `1em` times the sheet's emoji
  // factor, so a ratio is what it was in the first place. An absolute
  // size here would have to re-create, by hand, the growth a template
  // gives a short line — which arrives through the word and reaches a
  // ratio on its own.
  it('is sized against the word it rides, the way the baseline already sizes it', () => {
    expect(catalog.controlFor('decoration', ElementFieldId.RELATIVE_SIZE)?.unit).toBe('%');
    expect(catalog.controlFor('decoration', ElementFieldId.RELATIVE_SIZE)?.property).toBe('font-size');
  });
});

/**
 * The heading a field is filed under is the field's own answer, so a
 * kind says what it offers and never how it is arranged. Were it the
 * kind's answer, every new one — a GIF, an image — would restate the
 * whole organisation, and two of them could put one field in two
 * places: the same drift the shared dial above exists to prevent, one
 * level up.
 */
describe('the headings a kind of element offers', () => {
  it('hold every field it offers, exactly once', () => {
    for (const kind of ['segment', 'line', 'word', 'decoration'] as const) {
      const filed = catalog.sectionsFor(kind).flatMap((entry) => entry.controls.map((control) => control.id));
      expect(filed.slice().sort()).toEqual(catalog.controlsFor(kind).map((control) => control.id).sort());
      expect(new Set(filed).size).toBe(filed.length);
    }
  });

  it('files a field the same way on every kind that offers it', () => {
    const headingsById = new Map<string, string>();
    for (const kind of ['segment', 'line', 'word', 'decoration'] as const) {
      for (const entry of catalog.sectionsFor(kind)) {
        for (const control of entry.controls) {
          expect(headingsById.get(control.id) ?? entry.section).toBe(entry.section);
          headingsById.set(control.id, entry.section);
        }
      }
    }
  });

  it('leaves out a heading the kind offers nothing from', () => {
    expect(catalog.sectionsFor('decoration').map((entry) => entry.section)).toEqual(['layout']);
    expect(catalog.sectionsFor('word').map((entry) => entry.section)).toEqual(['text', 'layout']);
  });
});

describe('a kind of element naming a field', () => {
  // The name is an enum, so a typo cannot reach here. What can is a
  // field that exists and was never registered, which would otherwise
  // render one control short — and a control that was never offered
  // leaves no gap on screen where it would have been.
  it('is refused when the field was never registered', () => {
    const incomplete = new ElementFieldLibrary([new ItalicField()]);
    expect(() => incomplete.pick(ElementFieldId.ITALIC, ElementFieldId.FONT_SIZE)).toThrow(/font-size/);
  });
});

describe('being lifted out of the line', () => {
  it('is offered to what the user can drag and refused to what the layout owns', () => {
    expect(catalog.canBePlaced('word')).toBe(true);
    expect(catalog.canBePlaced('decoration')).toBe(true);
    expect(catalog.canBePlaced('segment')).toBe(true);
    expect(catalog.canBePlaced('line')).toBe(false);
  });
});
