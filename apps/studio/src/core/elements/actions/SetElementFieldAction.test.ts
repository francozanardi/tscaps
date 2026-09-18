import { describe, expect, it } from 'vitest';
import { CssFragmentParser, CssMinifier } from '@tscaps/engine';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { EditorStore } from '@core/editor/store/EditorStore';
import type { ElementDescendantResolver } from '@core/elements/domain/ElementDescendantResolver';
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
import { CssControlledFieldFinder } from '@core/elements/services/css/CssControlledFieldFinder';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { SetElementFieldAction } from '@core/elements/actions/SetElementFieldAction';

/**
 * What an answer given on one element does to the same field on the
 * elements inside it.
 *
 * A field an inner element was given its own answer for used to keep
 * deciding forever: a word somebody had turned underline off on stayed
 * off when the caption around it turned underline on, with no way back
 * short of finding that word again.
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
});

/** One caption, one line, two words, a glyph on the first of them. */
const INSIDE: Readonly<Record<string, ReadonlyArray<string>>> = {
  seg1: ['l1', 'w1', 'w2', 'w1:d'],
  l1: ['w1', 'w2', 'w1:d'],
  w1: ['w1:d'],
};

const descendantResolver: ElementDescendantResolver = {
  descendantsOf: (elementId) => new Set(INSIDE[elementId] ?? []),
};

// The document is never derived here, so re-piping it has nothing to do.
const refresh = { execute: () => {} } as unknown as RefreshDocumentAction;

function actionOn(store: EditorStore): SetElementFieldAction {
  const writer = new ElementControlCssWriter(new CssFragmentParser(new CssMinifier()));
  return new SetElementFieldAction(
    store,
    catalog,
    descendantResolver,
    writer,
    new CssControlledFieldFinder(writer),
    refresh,
  );
}

describe('a field answered on the caption', () => {
  it('is given up by the words inside it, declaration and all', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.execute('w1', 'word', catalog.requireControl('word', ElementFieldId.ROTATION), 5);
    action.execute('w1', 'word', catalog.requireControl('word', ElementFieldId.UNDERLINE), 'none');

    action.execute('seg1', 'segment', catalog.requireControl('segment', ElementFieldId.UNDERLINE), 'underline');

    const word = store.snapshot().elementStyles.get('w1');
    expect(word?.fields?.[ElementFieldId.UNDERLINE]).toBeUndefined();
    expect(word?.css).not.toContain('text-decoration-line');
    expect(word?.fields?.[ElementFieldId.ROTATION]).toBe(5);
  });

  it('leaves a declaration somebody has edited standing, so the CSS keeps deciding', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.execute('w1', 'word', catalog.requireControl('word', ElementFieldId.UNDERLINE), 'none');
    const edited = store.snapshot().elementStyles.withCss('w1', 'word', 'text-decoration-line: underline wavy;');
    store.patch({ elementStyles: edited });

    action.execute('seg1', 'segment', catalog.requireControl('segment', ElementFieldId.UNDERLINE), 'underline');

    const word = store.snapshot().elementStyles.get('w1');
    expect(word?.fields?.[ElementFieldId.UNDERLINE]).toBeUndefined();
    expect(word?.css).toContain('wavy');
  });

  it('reaches a word through the line it was laid out on', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.execute('w2', 'word', catalog.requireControl('word', ElementFieldId.PRIMARY_COLOR), '#ff0000');

    action.execute('seg1', 'segment', catalog.requireControl('segment', ElementFieldId.PRIMARY_COLOR), '#00ff00');

    expect(store.snapshot().elementStyles.get('w2')).toBeNull();
  });
});

/**
 * Underline and strikethrough are two switches over one declaration,
 * because CSS offers no longhand for either alone. One of them leaving
 * used to take the declaration with it, so the other's answer vanished
 * from the CSS while staying recorded — and the panel then reported a
 * field nobody had touched as one the user's own CSS had taken over.
 */
describe('two fields sharing one declaration', () => {
  function wordWithBothDecorations(): EditorStore {
    const store = new EditorStore();
    const action = actionOn(store);
    action.execute('w1', 'word', catalog.requireControl('word', ElementFieldId.UNDERLINE), 'none');
    action.execute('w1', 'word', catalog.requireControl('word', ElementFieldId.STRIKETHROUGH), 'line-through');
    return store;
  }

  it('keep the answer the caption said nothing about', () => {
    const store = wordWithBothDecorations();
    actionOn(store).execute('seg1', 'segment', catalog.requireControl('segment', ElementFieldId.STRIKETHROUGH), 'line-through');

    const word = store.snapshot().elementStyles.get('w1');
    expect(word?.fields?.[ElementFieldId.UNDERLINE]).toBe('none');
    expect(word?.css).toContain('text-decoration-line: none;');
  });

  it('leave the surviving one still deciding rather than reported as hand-edited', () => {
    const store = wordWithBothDecorations();
    actionOn(store).execute('seg1', 'segment', catalog.requireControl('segment', ElementFieldId.STRIKETHROUGH), 'line-through');

    const word = store.snapshot().elementStyles.get('w1');
    const writer = new ElementControlCssWriter(new CssFragmentParser(new CssMinifier()));
    const taken = new CssControlledFieldFinder(writer).find(word, catalog.controlsFor('word'));
    expect([...taken]).toEqual([]);
  });

  it('take the declaration away entirely when neither is recorded any more', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.execute('w1', 'word', catalog.requireControl('word', ElementFieldId.STRIKETHROUGH), 'line-through');

    action.execute('seg1', 'segment', catalog.requireControl('segment', ElementFieldId.STRIKETHROUGH), 'line-through');

    expect(store.snapshot().elementStyles.get('w1')).toBeNull();
  });
});

describe('a field whose value composes with the ones around it', () => {
  it('leaves a word turned where somebody turned it', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.execute('w1', 'word', catalog.requireControl('word', ElementFieldId.ROTATION), 12);

    action.execute('seg1', 'segment', catalog.requireControl('segment', ElementFieldId.ROTATION), -4);

    expect(store.snapshot().elementStyles.get('w1')?.fields?.[ElementFieldId.ROTATION]).toBe(12);
  });

  it('leaves a glyph at the ratio it was resized to when its word is resized', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.execute('w1:d', 'decoration', catalog.requireControl('decoration', ElementFieldId.RELATIVE_SIZE), 150);

    action.execute('w1', 'word', catalog.requireControl('word', ElementFieldId.RELATIVE_SIZE), 200);

    expect(store.snapshot().elementStyles.get('w1:d')?.fields?.[ElementFieldId.RELATIVE_SIZE]).toBe(150);
  });

  it('leaves a word its ratio when the caption is given a size, since they are not the same field', () => {
    const store = new EditorStore();
    const action = actionOn(store);
    action.execute('w1', 'word', catalog.requireControl('word', ElementFieldId.RELATIVE_SIZE), 150);

    action.execute('seg1', 'segment', catalog.requireControl('segment', ElementFieldId.FONT_SIZE), 8);

    expect(store.snapshot().elementStyles.get('w1')?.fields?.[ElementFieldId.RELATIVE_SIZE]).toBe(150);
  });
});

describe('one field applied to an explicit selection', () => {
  it('changes every selected element and undoes them together', () => {
    const store = new EditorStore();
    const action = actionOn(store);

    action.execute(
      ['w1', 'w2'],
      'word',
      catalog.requireControl('word', ElementFieldId.PRIMARY_COLOR),
      '#ff0000',
    );

    expect(store.snapshot().elementStyles.get('w1')?.fields?.[ElementFieldId.PRIMARY_COLOR]).toBe('#ff0000');
    expect(store.snapshot().elementStyles.get('w2')?.fields?.[ElementFieldId.PRIMARY_COLOR]).toBe('#ff0000');

    store.undo();
    expect(store.snapshot().elementStyles.get('w1')).toBeNull();
    expect(store.snapshot().elementStyles.get('w2')).toBeNull();
  });
});

/**
 * The one field that decides nothing through the element's CSS. What it
 * holds is a stack, and what draws is the family that stack compiles
 * to — a name the record cannot carry, layered over the element at
 * render time. A declaration here would name faces that never draw.
 */
describe('the font a caption is given', () => {
  const STACK = { latin: 'Anton', arabic: 'Lalezar', urdu: 'Lalezar', hebrew: 'Heebo Variable',
    cyrillic: 'Inter Variable', greek: 'Inter Variable', devanagari: 'Poppins',
    bengali: 'Noto Sans Bengali Variable', telugu: 'Noto Sans Telugu Variable',
    tamil: 'Noto Sans Tamil Variable', thai: 'Noto Sans Thai Variable' };

  function fontOn(store: EditorStore, elementId: string, kind: 'segment' | 'word'): void {
    actionOn(store).execute(elementId, kind, catalog.requireControl(kind, ElementFieldId.FONT_FAMILY), STACK);
  }

  it('is recorded, and writes nothing into the element CSS', () => {
    const store = new EditorStore();
    fontOn(store, 'seg1', 'segment');
    const segment = store.snapshot().elementStyles.get('seg1');
    expect(segment?.fields?.[ElementFieldId.FONT_FAMILY]).toEqual(STACK);
    expect(segment?.css).toBe('');
  });

  it('takes back a declaration an older version of this left behind, once cleared', () => {
    const store = new EditorStore();
    actionOn(store).execute('seg1', 'segment', catalog.requireControl('segment', ElementFieldId.ROTATION), 5);
    fontOn(store, 'seg1', 'segment');
    const legacy = store.snapshot().elementStyles.withCss(
      'seg1', 'segment', `${store.snapshot().elementStyles.get('seg1')!.css}--tscaps-font-family: "Roboto", "Amiri";`,
    );
    store.patch({ elementStyles: legacy });

    actionOn(store).clear('seg1', 'segment', catalog.requireControl('segment', ElementFieldId.FONT_FAMILY));

    const segment = store.snapshot().elementStyles.get('seg1');
    expect(segment?.fields?.[ElementFieldId.FONT_FAMILY]).toBeUndefined();
    expect(segment?.css).toContain('--tscaps-rotation');
    expect(segment?.css).not.toContain('font-family');
  });

  it('is never reported as taken over by the CSS, which cannot outrank it', () => {
    const store = new EditorStore();
    fontOn(store, 'w1', 'word');
    const edited = store.snapshot().elementStyles.withCss('w1', 'word', `font-family: "Comic Sans MS";`);
    store.patch({ elementStyles: edited });

    const writer = new ElementControlCssWriter(new CssFragmentParser(new CssMinifier()));
    const taken = new CssControlledFieldFinder(writer).find(
      store.snapshot().elementStyles.get('w1'),
      [catalog.requireControl('word', ElementFieldId.FONT_FAMILY)],
    );
    expect(taken.has(ElementFieldId.FONT_FAMILY)).toBe(false);
  });
});
