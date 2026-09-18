import { describe, expect, it } from 'vitest';
import type { Document } from '@tscaps/engine';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { CssFontFamilyReader } from '@core/fonts/services/CssFontFamilyReader';
import { DrawableFamilyResolver } from '@core/fonts/services/DrawableFamilyResolver';
import { DrawingFamilyFilter } from '@core/fonts/services/DrawingFamilyFilter';
import { FontScriptClassifier } from '@core/fonts/services/FontScriptClassifier';
import { SheetFontFamilyCollector } from '@core/fonts/services/SheetFontFamilyCollector';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { SheetCaptionTextCollector } from '@core/sheets/services/SheetCaptionTextCollector';

/**
 * Which faces an export is made to carry.
 *
 * Everything collected here is fetched and inlined as a data URI into
 * the stylesheet that ships with *every* rendered frame, so a face that
 * cannot end up drawing anything is pure payload. A stack names a face
 * per writing system; only the ones the captions actually hold a
 * character of can be selected, and only those earn their bytes.
 *
 * Filtering by `unicode-range` alone does not answer this: every face
 * here carries a Latin subset, so all of them cover Latin text and all
 * of them would sail through.
 */

const library = new FontStackLibrary();

const collector = new SheetFontFamilyCollector(
  new DrawableFamilyResolver(),
  new FontScriptClassifier(),
  new SheetCaptionTextCollector(),
  new CssFontFamilyReader(),
  new DrawingFamilyFilter(),
  library,
);

// A heavy display stack, whose faces are a different family per script.
const STACK = library.stackFor('komika-axis');
const LATIN_FACE = STACK.familyFor('latin');

function sheetShowing(overrides: Partial<Sheet> = {}): Sheet {
  return {
    id: 'main',
    template: { fontStackIds: [], styleControls: [] },
    styleValues: { values: {} },
    typographyConfig: { ...TYPOGRAPHY_DEFAULTS, fontStack: STACK },
    ...overrides,
  } as unknown as Sheet;
}

function documentSaying(text: string): Document {
  const words = text.split(' ').map((displayText, i) => ({ id: `w${i}`, displayText }));
  const segments = [{ id: 's1', getWords: () => words, lines: [{ words }] }];
  return { sections: [{ kind: 'main', segments }] } as unknown as Document;
}

function familiesFor(text: string): Set<string> {
  return collector.collect({
    sheet: sheetShowing(),
    document: documentSaying(text),
    sheetCss: '',
    elementStyles: ElementStyles.empty(),
  });
}

function usesDeviceFont(stack: ReturnType<FontStackLibrary['stackFor']>, text: string): boolean {
  return collector.usesDeviceFont({
    sheet: sheetShowing({ typographyConfig: { ...TYPOGRAPHY_DEFAULTS, fontStack: stack } }),
    document: documentSaying(text),
    sheetCss: '',
    elementStyles: ElementStyles.empty(),
  });
}

describe('the faces of a sheet stack an export carries', () => {
  it('carries the Latin one alone for text nobody wrote another alphabet in', () => {
    expect(familiesFor('the quick brown fox')).toEqual(new Set([LATIN_FACE]));
  });

  // The Latin face is in the emitted stack but no character can reach
  // it, and it does not lead, so it takes its metrics duty with it.
  it('leaves out the Latin one for captions holding no Latin', () => {
    expect(familiesFor('שלום עולם')).toEqual(new Set([STACK.familyFor('hebrew')]));
  });

  it('carries the Arabic face for Arabic text', () => {
    expect(familiesFor('مرحبا بالعالم')).toEqual(
      new Set([STACK.familyFor('arabic')]),
    );
  });

  it.each([
    ['bengali', 'বাংলা'],
    ['telugu', 'తెలుగు'],
    ['tamil', 'தமிழ்'],
    ['thai', 'ภาษาไทย'],
  ] as const)('carries the managed %s face instead of a device font', (script, text) => {
    expect(familiesFor(text)).toEqual(new Set([STACK.familyFor(script)]));
    expect(usesDeviceFont(STACK, text)).toBe(false);
  });

  it('uses the Urdu choice even when Latin dominates the caption', () => {
    expect(familiesFor('mostly Latin letters in this sentence ہوں')).toEqual(new Set([
      LATIN_FACE, STACK.familyFor('urdu'),
    ]));
  });

  it('carries every face the mixed text can reach', () => {
    expect(familiesFor('hello שלום مرحبا')).toEqual(new Set([
      LATIN_FACE,
      STACK.familyFor('hebrew'),
      STACK.familyFor('arabic'),
    ]));
  });

  it('keeps one literal device family for unsupported writing systems', () => {
    expect(familiesFor('日本語 한국어')).toEqual(new Set(['sans-serif']));
  });

  it('keeps an uploaded family selected for unsupported writing systems', () => {
    const stack = STACK.with('other', 'My CJK Font');
    const families = collector.collect({
      sheet: sheetShowing({ typographyConfig: { ...TYPOGRAPHY_DEFAULTS, fontStack: stack } }),
      document: documentSaying('hello 世界'),
      sheetCss: '',
      elementStyles: ElementStyles.empty(),
    });
    expect(families).toEqual(new Set([LATIN_FACE, 'My CJK Font']));
  });
});

describe('faces that come from somewhere other than the sheet stack', () => {
  it('keeps a family the template CSS names outright', () => {
    const families = collector.collect({
      sheet: sheetShowing(),
      document: documentSaying('latin only'),
      sheetCss: `.word { font-family: 'Bungee'; }`,
      elementStyles: ElementStyles.empty(),
    });
    expect(families).toEqual(new Set([LATIN_FACE, 'Bungee']));
  });
});

describe('device font dependencies', () => {
  it('reports a generic Other face only when unsupported letters can reach it', () => {
    expect(usesDeviceFont(STACK, '日本語')).toBe(true);
    expect(usesDeviceFont(STACK, 'latin only')).toBe(false);
  });

  it('does not report an uploaded Other face', () => {
    expect(usesDeviceFont(STACK.with('other', 'My CJK Font'), '日本語')).toBe(false);
  });
});

/**
 * A template can hand a second face to part of the caption through a
 * `font`-typed control. Its stack is stored against the sheet, and the
 * CSS names a family only as that property's `var()` fallback — which
 * this collector skips on purpose. So the control's own value is the
 * one source that can put those faces on the list.
 */
describe('the faces a template offers through a font control', () => {
  const ACCENT = library.stackFor('anton');

  function sheetWithAccent(value: unknown): Sheet {
    return sheetShowing({
      template: { fontStackIds: [], styleControls: [{ id: 'tag-font-family', type: 'font', default: ACCENT.toSnapshot() }] },
      styleValues: { values: { 'tag-font-family': value } },
    } as unknown as Partial<Sheet>);
  }

  function familiesWith(value: unknown, text: string): Set<string> {
    return collector.collect({
      sheet: sheetWithAccent(value),
      document: documentSaying(text),
      sheetCss: `.accent { font-family: var(--tscaps-tag-font-family, 'Anton'); }`,
      elementStyles: ElementStyles.empty(),
    });
  }

  it('carries the face its stack draws the captions with', () => {
    expect(familiesWith(ACCENT.toSnapshot(), 'latin only'))
      .toEqual(new Set([LATIN_FACE, ACCENT.familyFor('latin')]));
  });

  // The accent has to answer for every alphabet the captions hold,
  // because which words the template's own rule paints with it is not
  // knowable from here.
  it('carries the face its stack draws each alphabet the captions hold with', () => {
    expect(familiesWith(ACCENT.toSnapshot(), 'hello שלום')).toEqual(new Set([
      LATIN_FACE,
      STACK.familyFor('hebrew'),
      ACCENT.familyFor('latin'),
      ACCENT.familyFor('hebrew'),
    ]));
  });

  // Deliberate, and the reason the control's value has to be stored as a
  // stack: a face named only as a `var()` fallback is one the export
  // ships no `@font-face` for while the CSS still asks for it.
  it('carries nothing for a control holding no stack', () => {
    expect(familiesWith(undefined, 'latin only')).toEqual(new Set([LATIN_FACE]));
  });
});
