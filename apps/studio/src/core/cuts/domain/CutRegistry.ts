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

  private constructor(private readonly ranges: readonly CutRange[]) {}

  list(): readonly CutRange[] {
    return this.ranges;
  }

  isEmpty(): boolean {
    return this.ranges.length === 0;
  }

  toSnapshot(): CutsSnapshot {
    return this.ranges;
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
