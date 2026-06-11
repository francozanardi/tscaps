/**
 * A set of Unicode codepoint ranges, parsed from a CSS `unicode-range`
 * declaration. Built by {@link UnicodeRangeParser}; consumers query it
 * to decide whether a given font subset covers any of the characters
 * a document needs.
 */
export class UnicodeRangeSet {

  constructor(private readonly ranges: ReadonlyArray<readonly [number, number]>) {}

  /** True when any of the provided codepoints falls inside one of the ranges. */
  intersectsAny(points: Iterable<number>): boolean {
    for (const cp of points) {
      for (const [start, end] of this.ranges) {
        if (cp >= start && cp <= end) return true;
      }
    }
    return false;
  }
}
