/** Inclusive code point interval. */
type Interval = readonly [number, number];

/**
 * A set of Unicode code points, parsed from a CSS `unicode-range`
 * declaration by {@link UnicodeRangeParser} or derived from another set.
 *
 * Normalised on construction — sorted, with touching and overlapping
 * intervals merged — so two sets holding the same code points serialize
 * to the same string. Immutable.
 */
export class UnicodeRangeSet {

  private readonly intervals: ReadonlyArray<Interval>;

  constructor(intervals: ReadonlyArray<Interval>) {
    this.intervals = UnicodeRangeSet.normalize(intervals);
  }

  /** Every code point Unicode defines, which is what a `@font-face` with no `unicode-range` covers. */
  static full(): UnicodeRangeSet {
    return new UnicodeRangeSet([[0, 0x10FFFF]]);
  }

  private static normalize(intervals: ReadonlyArray<Interval>): ReadonlyArray<Interval> {
    const sorted = [...intervals].filter(([start, end]) => end >= start).sort((a, b) => a[0] - b[0]);
    const merged: Interval[] = [];
    for (const [start, end] of sorted) {
      const last = merged[merged.length - 1];
      // `start - 1` so [0,9] and [10,20] merge: they are adjacent over
      // integers even though they do not overlap.
      if (last !== undefined && start - 1 <= last[1]) {
        merged[merged.length - 1] = [last[0], Math.max(last[1], end)];
        continue;
      }
      merged.push([start, end]);
    }
    return merged;
  }

  /** True when any of the provided code points falls inside the set. */
  intersectsAny(points: Iterable<number>): boolean {
    for (const point of points) {
      if (this.intervals.some(([start, end]) => point >= start && point <= end)) return true;
    }
    return false;
  }

  isEmpty(): boolean {
    return this.intervals.length === 0;
  }

  /** The code points this set holds and `other` does not. */
  subtract(other: UnicodeRangeSet): UnicodeRangeSet {
    let remaining: Interval[] = [...this.intervals];
    for (const [cutStart, cutEnd] of other.intervals) {
      const next: Interval[] = [];
      for (const [start, end] of remaining) {
        if (cutEnd < start || cutStart > end) {
          next.push([start, end]);
          continue;
        }
        if (start < cutStart) next.push([start, cutStart - 1]);
        if (end > cutEnd) next.push([cutEnd + 1, end]);
      }
      remaining = next;
    }
    return new UnicodeRangeSet(remaining);
  }

  /** The code points both sets hold. */
  intersect(other: UnicodeRangeSet): UnicodeRangeSet {
    return this.subtract(this.subtract(other));
  }

  /** The code points either set holds. */
  union(other: UnicodeRangeSet): UnicodeRangeSet {
    return new UnicodeRangeSet([...this.intervals, ...other.intervals]);
  }

  /** The set as a CSS `unicode-range` value. Empty string when the set holds nothing. */
  toCssValue(): string {
    return this.intervals.map(([start, end]) => this.formatInterval(start, end)).join(',');
  }

  private formatInterval(start: number, end: number): string {
    const from = start.toString(16).toUpperCase();
    return start === end ? `U+${from}` : `U+${from}-${end.toString(16).toUpperCase()}`;
  }
}
