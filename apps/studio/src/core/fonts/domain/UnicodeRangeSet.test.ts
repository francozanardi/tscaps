import { describe, expect, it } from 'vitest';
import { UnicodeRangeSet } from '@core/fonts/domain/UnicodeRangeSet';

/**
 * The code points one face of a compiled stack is left to draw.
 *
 * A stack becomes a single family whose faces are told apart by
 * `unicode-range` alone, so the face that leads keeps everything it
 * covers and each face behind it keeps only what nobody ahead claimed.
 * An interval lost or double-counted here sends characters to the
 * device's own font, which renders — quietly, and in the wrong face.
 */

const set = (...intervals: ReadonlyArray<readonly [number, number]>) => new UnicodeRangeSet(intervals);

describe('a set of code point intervals', () => {
  it('merges intervals that overlap', () => {
    expect(set([0x20, 0x40], [0x30, 0x50]).toCssValue()).toBe('U+20-50');
  });

  it('merges intervals that touch without overlapping', () => {
    expect(set([0x20, 0x2F], [0x30, 0x40]).toCssValue()).toBe('U+20-40');
  });

  it('orders intervals however they arrive', () => {
    expect(set([0x100, 0x200], [0x20, 0x40]).toCssValue()).toBe('U+20-40,U+100-200');
  });

  it('writes a single code point without a range', () => {
    expect(set([0x20, 0x20]).toCssValue()).toBe('U+20');
  });

  it('drops an interval that ends before it starts', () => {
    expect(set([0x40, 0x20]).isEmpty()).toBe(true);
  });
});

describe('subtracting what another face already claims', () => {
  it('keeps what the other set does not hold', () => {
    expect(set([0x20, 0x100]).subtract(set([0x40, 0x60])).toCssValue()).toBe('U+20-3F,U+61-100');
  });

  it('trims an interval the other set overlaps at one end', () => {
    expect(set([0x20, 0x100]).subtract(set([0x0, 0x40])).toCssValue()).toBe('U+41-100');
  });

  it('empties an interval the other set covers whole', () => {
    expect(set([0x20, 0x100]).subtract(set([0x0, 0x200])).isEmpty()).toBe(true);
  });

  it('leaves an interval the other set does not reach', () => {
    expect(set([0x600, 0x6FF]).subtract(set([0x0, 0xFF])).toCssValue()).toBe('U+600-6FF');
  });

  it('subtracts every interval of the other set, not only the first', () => {
    expect(set([0x0, 0x100]).subtract(set([0x20, 0x2F], [0x40, 0x4F])).toCssValue())
      .toBe('U+0-1F,U+30-3F,U+50-100');
  });

  it('leaves the space to the face that claimed it first', () => {
    const latin = set([0x0, 0xFF]);
    const arabic = set([0x0, 0xFF], [0x600, 0x6FF]);
    expect(arabic.subtract(latin).intersectsAny([0x20])).toBe(false);
    expect(latin.intersectsAny([0x20])).toBe(true);
  });

  it('keeps the punctuation a narrow partition would lose', () => {
    // The curly apostrophe and the em dash live in General Punctuation,
    // outside every per-alphabet block anybody would write by hand.
    const antonLatin = set([0x0, 0xFF], [0x2000, 0x206F]);
    const remaining = antonLatin.subtract(set([0x600, 0x6FF]));
    expect(remaining.intersectsAny([0x2019, 0x2014])).toBe(true);
  });
});

describe('the union of two sets', () => {
  it('holds the code points of both', () => {
    expect(set([0x20, 0x40]).union(set([0x600, 0x6FF])).toCssValue()).toBe('U+20-40,U+600-6FF');
  });

  it('merges them where they meet', () => {
    expect(set([0x20, 0x40]).union(set([0x41, 0x50])).toCssValue()).toBe('U+20-50');
  });
});

describe('the set a face with no declared range covers', () => {
  it('holds every code point Unicode defines', () => {
    expect(UnicodeRangeSet.full().intersectsAny([0x0, 0x10FFFF])).toBe(true);
  });

  it('leaves nothing behind once another face has claimed everything', () => {
    expect(UnicodeRangeSet.full().subtract(UnicodeRangeSet.full()).isEmpty()).toBe(true);
  });
});
