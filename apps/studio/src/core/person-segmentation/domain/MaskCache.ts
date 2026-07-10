import type { PersonSegmentationMask } from '@core/person-segmentation/domain/PersonSegmentationMask';

/**
 * Time-ordered collection of per-frame actor masks. Consumers query it
 * by video timestamp and receive the temporally closest mask within a
 * tolerance, or `null` when no cached mask lands close enough. Entries
 * must be inserted in strictly increasing time order.
 */
export class MaskCache {
  private readonly entries: PersonSegmentationMask[] = [];

  add(mask: PersonSegmentationMask): void {
    this.entries.push(mask);
  }

  /**
   * Returns the cached mask whose timestamp is closest to `t`, but only
   * if its distance to `t` is within `maxDeltaSec`. Returns `null`
   * otherwise, so callers can fall back to a live segmentation.
   */
  nearest(t: number, maxDeltaSec: number): PersonSegmentationMask | null {
    if (this.entries.length === 0) return null;
    let lo = 0, hi = this.entries.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.entries[mid]!.t < t) lo = mid + 1;
      else hi = mid;
    }
    const candidates: PersonSegmentationMask[] = [this.entries[lo]!];
    if (lo > 0) candidates.push(this.entries[lo - 1]!);
    let best: PersonSegmentationMask | null = null;
    let bestDistance = Infinity;
    for (const candidate of candidates) {
      const distance = Math.abs(candidate.t - t);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    return bestDistance <= maxDeltaSec ? best : null;
  }

  /**
   * New cache holding both collections' masks in time order. When both
   * carry a mask at the exact same timestamp, `other`'s wins.
   */
  mergedWith(other: MaskCache): MaskCache {
    const byTime = new Map<number, PersonSegmentationMask>();
    for (const mask of this.entries) byTime.set(mask.t, mask);
    for (const mask of other.entries) byTime.set(mask.t, mask);
    const merged = new MaskCache();
    for (const mask of [...byTime.values()].sort((a, b) => a.t - b.t)) merged.add(mask);
    return merged;
  }

  size(): number {
    return this.entries.length;
  }

  approxMemoryBytes(): number {
    if (this.entries.length === 0) return 0;
    return this.entries.reduce((total, entry) => total + entry.alpha.length, 0);
  }

  toArray(): ReadonlyArray<PersonSegmentationMask> {
    return this.entries;
  }
}
