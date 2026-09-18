export interface CutRange {
  readonly startSec: number;
  readonly endSec: number;
}

export type CutsSnapshot = ReadonlyArray<CutRange>;

/**
 * Time ranges marked as removed from the active video. Immutable;
 * mutation methods return a new instance. Stored ranges never
 * overlap — `add` fuses overlapping or touching ranges into a single
 * span — so a time point belongs to at most one cut.
 */
export class CutRegistry {

  static empty(): CutRegistry {
    return new CutRegistry([]);
  }

  static fromSnapshot(snapshot: CutsSnapshot): CutRegistry {
    const sanitized: CutRange[] = [];
    for (const range of snapshot) {
      if (!Number.isFinite(range.startSec) || !Number.isFinite(range.endSec)) continue;
      if (range.endSec <= range.startSec) continue;
      sanitized.push({ startSec: range.startSec, endSec: range.endSec });
    }
    return new CutRegistry(sanitized);
  }

  private readonly ranges: readonly CutRange[];

  private constructor(ranges: readonly CutRange[]) {
    this.ranges = [...ranges].sort((a, b) => a.startSec - b.startSec);
  }

  list(): readonly CutRange[] {
    return this.ranges;
  }

  isEmpty(): boolean {
    return this.ranges.length === 0;
  }

  toSnapshot(): CutsSnapshot {
    return this.ranges;
  }

  /**
   * How much of the video the stored ranges take away, in seconds. A
   * plain sum is exact because the ranges never overlap.
   */
  totalSec(): number {
    return this.ranges.reduce((total, range) => total + (range.endSec - range.startSec), 0);
  }

  add(range: CutRange): CutRegistry {
    if (range.endSec <= range.startSec) return this;
    if (this.ranges.some((c) => c.startSec <= range.startSec && c.endSec >= range.endSec)) {
      return this;
    }
    let mergedStart = range.startSec;
    let mergedEnd = range.endSec;
    const disjoint: CutRange[] = [];
    for (const existing of this.ranges) {
      if (existing.endSec < range.startSec || existing.startSec > range.endSec) {
        disjoint.push(existing);
        continue;
      }
      mergedStart = Math.min(mergedStart, existing.startSec);
      mergedEnd = Math.max(mergedEnd, existing.endSec);
    }
    return new CutRegistry([...disjoint, { startSec: mergedStart, endSec: mergedEnd }]);
  }

  /**
   * Whether the half-open interval `[startSec, endSec)` is fully
   * contained in some stored cut range. Used by consumers that want
   * to decide whether an item with a narration window (a word) is
   * inside a cut. Boundary policy mirrors the rest of the time
   * arithmetic in the codebase: a range exactly equal to a stored
   * cut counts as fully contained.
   */
  containsTimeRange(startSec: number, endSec: number): boolean {
    for (const range of this.ranges) {
      if (startSec >= range.startSec && endSec <= range.endSec) return true;
    }
    return false;
  }

  /** Whether the given time position falls inside a cut range. */
  isCut(timeSec: number): boolean {
    for (const range of this.ranges) {
      if (timeSec >= range.startSec && timeSec < range.endSec) return true;
    }
    return false;
  }

  /**
   * Returns the earliest uncut time at or after `timeSec`. If `timeSec`
   * falls inside a cut range `[start, end]`, advances to `end`.
   */
  nextUncutTime(timeSec: number): number {
    for (const range of this.ranges) {
      if (timeSec >= range.startSec && timeSec < range.endSec) return range.endSec;
    }
    return timeSec;
  }

  /**
   * Returns the latest uncut time at or before `timeSec`. If `timeSec`
   * falls inside a cut range `(start, end]`, retreats to `start`.
   */
  prevUncutTime(timeSec: number): number {
    for (const range of this.ranges) {
      if (timeSec > range.startSec && timeSec <= range.endSec) return range.startSec;
    }
    return timeSec;
  }

  /**
   * The start time of the first cut strictly after `timeSec`, or `null`
   * if no cut starts after it.
   */
  nextCutStart(timeSec: number): number | null {
    for (const range of this.ranges) {
      if (range.startSec > timeSec) return range.startSec;
    }
    return null;
  }

  /**
   * The end time of the last cut strictly before `timeSec`, or `null`
   * if no cut ends before it.
   */
  prevCutEnd(timeSec: number): number | null {
    for (let i = this.ranges.length - 1; i >= 0; i--) {
      const range = this.ranges[i]!;
      if (range.endSec < timeSec) return range.endSec;
    }
    return null;
  }

  /**
   * Non-cut intervals covering `[0, videoDurationSec]`. Returns an empty
   * array when the video duration is zero or entirely cut.
   */
  uncutSpans(videoDurationSec: number): ReadonlyArray<CutRange> {
    if (videoDurationSec <= 0) return [];
    const spans: CutRange[] = [];
    let cursor = 0;
    for (const cut of this.ranges) {
      const cutStart = Math.min(cut.startSec, videoDurationSec);
      const cutEnd = Math.min(cut.endSec, videoDurationSec);
      if (cutStart > cursor) spans.push({ startSec: cursor, endSec: cutStart });
      cursor = Math.max(cursor, cutEnd);
      if (cursor >= videoDurationSec) break;
    }
    if (cursor < videoDurationSec) spans.push({ startSec: cursor, endSec: videoDurationSec });
    return spans;
  }

  removeAt(timeSec: number): CutRegistry {
    const next = this.ranges.filter((r) => timeSec < r.startSec || timeSec > r.endSec);
    if (next.length === this.ranges.length) return this;
    return new CutRegistry(next);
  }

  /**
   * Removes `range` from every overlapping stored cut. A stored cut
   * fully covered by `range` disappears; one with the subtracted
   * range strictly inside it splits into two. No-op when `range`
   * doesn't overlap any stored cut.
   */
  subtract(range: CutRange): CutRegistry {
    if (range.endSec <= range.startSec) return this;
    const next: CutRange[] = [];
    let changed = false;
    for (const existing of this.ranges) {
      if (existing.endSec <= range.startSec || existing.startSec >= range.endSec) {
        next.push(existing);
        continue;
      }
      changed = true;
      if (existing.startSec < range.startSec) {
        next.push({ startSec: existing.startSec, endSec: range.startSec });
      }
      if (existing.endSec > range.endSec) {
        next.push({ startSec: range.endSec, endSec: existing.endSec });
      }
    }
    if (!changed) return this;
    return new CutRegistry(next);
  }
}
