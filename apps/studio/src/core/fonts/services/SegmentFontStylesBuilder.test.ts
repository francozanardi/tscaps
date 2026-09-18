import { describe, expect, it } from 'vitest';
import { Line, Segment, TimeFragment, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { CaptionScripts } from '@core/fonts/domain/CaptionScripts';
import type { FontStack } from '@core/fonts/domain/FontStack';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { CompiledFamilyNamer } from '@core/fonts/services/CompiledFamilyNamer';
import { DrawableFamilyResolver } from '@core/fonts/services/DrawableFamilyResolver';
import { FontStackResolver } from '@core/fonts/services/FontStackResolver';
import { SegmentFontStylesBuilder } from '@core/fonts/services/SegmentFontStylesBuilder';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

/**
 * Which caption elements declare a font of their own, and what they
 * declare.
 *
 * The answer is short because the sheet's stack compiles to one family
 * that already carries every alphabet: an element declares a font only
 * when the reader gave it one. Both render paths come through this
 * builder, so what holds here holds for the preview and the burned file
 * alike.
 */

const library = new FontStackLibrary();
const builder = new SegmentFontStylesBuilder(
  new FontStackResolver(new CompiledFamilyNamer(), new DrawableFamilyResolver()),
);

const SEGMENT_ID = 's1';
const LINE_ID = 'l1';
const RUSSIAN_WORD_ID = 'w1';
const LATIN_WORD_ID = 'w2';
const DIGITS_WORD_ID = 'w3';

function russianSheet(stack: FontStack): Sheet {
  return {
    id: 'main',
    scripts: new CaptionScripts('cyrillic', new Set(['cyrillic', 'latin'])),
    typographyConfig: { ...TYPOGRAPHY_DEFAULTS, fontStack: stack },
  } as unknown as Sheet;
}

function mixedSegment(): Segment {
  return new Segment({
    id: SEGMENT_ID,
    lines: [new Line({
      id: LINE_ID,
      words: [
        new Word({ id: RUSSIAN_WORD_ID, text: 'русские', time: new TimeFragment(0, 1) }),
        new Word({ id: LATIN_WORD_ID, text: 'latin', time: new TimeFragment(1, 2) }),
        new Word({ id: DIGITS_WORD_ID, text: '123', time: new TimeFragment(2, 3) }),
      ],
    })],
  });
}

/** The family that draws, which is the one the faces were compiled into. */
function compiledIn(value: string): string {
  return value.split(',')[0]!.trim().replaceAll("'", '');
}

/** Whatever is named behind it, which a stack with captions to compile against does not carry. */
function facesIn(value: string): string[] {
  return value.split(',').slice(1).map((family) => family.trim().replaceAll("'", ''));
}

function stylesGiving(elementId: string, kind: string, stack: FontStack): ElementStyles {
  return ElementStyles.fromSnapshot({
    [elementId]: { kind, css: '', fields: { [ElementFieldId.FONT_FAMILY]: stack.toSnapshot() } },
  } as never);
}

describe('a word the reader never gave a font', () => {
  const sheet = russianSheet(library.stackFor('anton'));

  it('declares nothing, whichever alphabet it is written in', () => {
    const families = builder.buildWordFontFamilies(sheet, mixedSegment(), ElementStyles.empty());
    expect(families.size).toBe(0);
  });

  it('declares nothing under a segment the reader did give one', () => {
    const families = builder.buildWordFontFamilies(
      sheet,
      mixedSegment(),
      stylesGiving(SEGMENT_ID, 'segment', library.stackFor('lora')),
    );
    expect(families.has(LATIN_WORD_ID)).toBe(false);
    expect(families.has(DIGITS_WORD_ID)).toBe(false);
  });
});

describe('an element the reader gave its own stack', () => {
  const sheet = russianSheet(library.stackFor('anton'));

  function segmentGiven(stackId: string): string {
    return builder.buildSegmentFontVars(
      sheet, mixedSegment(), stylesGiving(SEGMENT_ID, 'segment', library.stackFor(stackId)),
    )[TemplateCssVariable.FONT_FAMILY]!;
  }

  it('draws the word with the family its own stack compiles to, not the sheet\'s', () => {
    const declared = (stackId: string): string => builder.buildWordFontFamilies(
      sheet, mixedSegment(), stylesGiving(RUSSIAN_WORD_ID, 'word', library.stackFor(stackId)),
    ).get(RUSSIAN_WORD_ID)!;
    expect(compiledIn(declared('lora'))).not.toBe(compiledIn(declared('anton')));
  });

  it('emits a segment variable for the stack the segment was given', () => {
    expect(compiledIn(segmentGiven('lora'))).not.toBe(compiledIn(segmentGiven('anton')));
  });

  it('emits no segment variable for a segment that was given none', () => {
    const vars = builder.buildSegmentFontVars(sheet, mixedSegment(), ElementStyles.empty());
    expect(Object.keys(vars)).toEqual([]);
  });

  // A face named behind the compiled family draws only where that
  // family failed to, and draws something plausible in another typeface
  // and another box — a fault the reader cannot see.
  it('names the compiled family and nothing behind it', () => {
    expect(facesIn(segmentGiven('lora'))).toEqual([]);
  });
});

/**
 * The promise the whole shape exists for: the faces of a stack are
 * independent. Tuning the one that draws Cyrillic must not move the one
 * that draws Latin.
 */
describe('a sheet whose stack was tuned on one face', () => {
  it('compiles to a family of its own once a face is tuned', () => {
    const before = library.stackFor('anton');
    const tuned = before.with('cyrillic', 'Roboto');
    const declared = (stack: FontStack): string => builder.buildSegmentFontVars(
      russianSheet(stack), mixedSegment(), stylesGiving(SEGMENT_ID, 'segment', stack),
    )[TemplateCssVariable.FONT_FAMILY]!;
    expect(compiledIn(declared(tuned))).not.toBe(compiledIn(declared(before)));
  });

  it('leaves the face drawing every other alphabet where it was', () => {
    const before = library.stackFor('anton');
    const tuned = before.with('cyrillic', 'Roboto');
    expect(tuned.familyFor('latin')).toBe(before.familyFor('latin'));
  });
});

describe('a line the reader gave its own stack', () => {
  const sheet = russianSheet(library.stackFor('anton'));

  it('emits a variable for the line, which its words inherit', () => {
    const declared = (stackId: string): string => builder.buildLineFontVars(
      sheet, mixedSegment(), stylesGiving(LINE_ID, 'line', library.stackFor(stackId)),
    ).get(LINE_ID)![TemplateCssVariable.FONT_FAMILY]!;
    expect(compiledIn(declared('lora'))).not.toBe(compiledIn(declared('anton')));
  });

  it('emits nothing for a line that was given none', () => {
    expect(builder.buildLineFontVars(sheet, mixedSegment(), ElementStyles.empty()).size).toBe(0);
  });

  it('leaves the words under it declaring nothing of their own', () => {
    const families = builder.buildWordFontFamilies(
      sheet, mixedSegment(), stylesGiving(LINE_ID, 'line', library.stackFor('lora')),
    );
    expect(families.size).toBe(0);
  });
});

describe('the family a stack compiles to', () => {
  it('differs between two sheets whose captions are in different alphabets', () => {
    const stack = library.stackFor('anton');
    const cyrillic = builder.buildSegmentFontVars(
      russianSheet(stack),
      mixedSegment(),
      stylesGiving(SEGMENT_ID, 'segment', stack),
    );
    const latinOnly = {
      ...russianSheet(stack),
      scripts: new CaptionScripts('latin', new Set(['latin'])),
    } as unknown as Sheet;
    const latin = builder.buildSegmentFontVars(
      latinOnly,
      mixedSegment(),
      stylesGiving(SEGMENT_ID, 'segment', stack),
    );
    expect(compiledIn(cyrillic[TemplateCssVariable.FONT_FAMILY]!))
      .not.toBe(compiledIn(latin[TemplateCssVariable.FONT_FAMILY]!));
  });
});
