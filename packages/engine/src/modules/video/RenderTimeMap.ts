/**
 * A half-open time window in seconds. The end is exclusive: a sample
 * at `endSec` is considered outside the range.
 */
export interface TimeRange {
  readonly startSec: number;
  readonly endSec: number;
}

/**
 * Maps source timestamps to output timestamps for a render that
 * excludes one or more time windows. Source positions inside an
 * excluded window collapse to the window's start in output time;
 * positions past a window are shifted earlier by the cumulative
 * skipped duration.
 *
 * Constructed once per render and queried per video frame and per
 * audio packet/sample. Ranges are sorted internally and assumed
 * non-overlapping (callers should merge touching/overlapping
 * intervals before passing them in).
 *
 * An empty mapper is the identity: `isSkipped` is always false and
 * `toOutputTime` returns the input unchanged.
 */
export class RenderTimeMap {

  private readonly sortedRanges: ReadonlyArray<TimeRange>;

  constructor(ranges: ReadonlyArray<TimeRange>) {
    this.sortedRanges = [...ranges].sort((a, b) => a.startSec - b.startSec);
  }

  isEmpty(): boolean {
    return this.sortedRanges.length === 0;
  }

  isSkipped(sourceTimeSec: number): boolean {
    for (const range of this.sortedRanges) {
      if (sourceTimeSec < range.startSec) return false;
      if (sourceTimeSec < range.endSec) return true;
    }
    return false;
  }

  toOutputTime(sourceTimeSec: number): number {
    let skipped = 0;
    for (const range of this.sortedRanges) {
      if (sourceTimeSec < range.startSec) break;
      const end = Math.min(sourceTimeSec, range.endSec);
      skipped += end - range.startSec;
    }
    return sourceTimeSec - skipped;
  }

  /**
   * Inverse of {@link toOutputTime}. An output position that lands
   * exactly on a collapsed window — the multiple source positions
   * mapping to the same output value — resolves to the window's
   * right-hand source side so playback continues past the skip.
   */
  toSourceTime(outputTimeSec: number): number {
    let sourceTime = outputTimeSec;
    for (const range of this.sortedRanges) {
      if (sourceTime < range.startSec) break;
      sourceTime += range.endSec - range.startSec;
    }
    return sourceTime;
  }

  totalSkipDuration(): number {
    let total = 0;
    for (const range of this.sortedRanges) total += range.endSec - range.startSec;
    return total;
  }
}
