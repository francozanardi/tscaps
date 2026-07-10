import { UnicodeRangeSet } from '@core/fonts/domain/UnicodeRangeSet';

/**
 * Parses a CSS `unicode-range` declaration into a {@link UnicodeRangeSet}.
 * Empty or unparseable input yields the full Unicode range, matching the
 * CSS default behavior when `unicode-range` is omitted from a `@font-face`
 * rule.
 */
export class UnicodeRangeParser {

  parse(input: string): UnicodeRangeSet {
    const trimmed = input.trim();
    if (!trimmed) return new UnicodeRangeSet([[0, 0x10FFFF]]);
    const ranges: Array<readonly [number, number]> = [];
    for (const part of trimmed.split(',')) {
      const range = this.parsePart(part.trim());
      if (range) ranges.push(range);
    }
    if (ranges.length === 0) return new UnicodeRangeSet([[0, 0x10FFFF]]);
    return new UnicodeRangeSet(ranges);
  }

  private parsePart(part: string): readonly [number, number] | null {
    const m = /^U\+([0-9A-F?]+)(?:-([0-9A-F]+))?$/i.exec(part);
    if (!m) return null;
    const left = m[1]!;
    const right = m[2];
    if (right !== undefined) {
      return [parseInt(left, 16), parseInt(right, 16)];
    }
    if (left.includes('?')) {
      // `U+22?` is shorthand for `U+220-22F`: each `?` widens the literal
      // to a full nibble (0 in start, F in end).
      const start = parseInt(left.replace(/\?/g, '0'), 16);
      const end = parseInt(left.replace(/\?/g, 'F'), 16);
      return [start, end];
    }
    const cp = parseInt(left, 16);
    return [cp, cp];
  }
}
