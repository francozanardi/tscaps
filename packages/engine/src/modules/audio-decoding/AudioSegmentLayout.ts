/**
 * Where the segments of a track begin and end, on the source's own
 * timeline. Each is trusted over one stretch of `segmentSeconds`
 * counted from zero and reaches `marginSeconds` past it at both ends,
 * so its edge frames have the neighbours a codec reconstructs them
 * from.
 *
 * `segmentSeconds` of `Infinity` describes one segment covering
 * everything.
 */
export class AudioSegmentLayout {

  constructor(
    private readonly segmentSeconds: number,
    private readonly marginSeconds: number,
  ) {}

  /** Timestamp from which the segment collects packets. */
  collectsFrom(index: number): number {
    if (index === 0) return -Infinity;
    return this.boundary(index) - this.marginSeconds;
  }

  /** Timestamp from which the segment's samples are a faithful decode. */
  usableFrom(index: number): number {
    return this.boundary(index);
  }

  /** Timestamp at which the segment stops collecting packets. */
  endsAt(index: number): number {
    return this.boundary(index + 1) + this.marginSeconds;
  }

  private boundary(index: number): number {
    // Spelled out because `0 * Infinity` is NaN, and an unsegmented
    // layout is exactly the case where that happens.
    if (index === 0) return 0;
    return index * this.segmentSeconds;
  }
}
