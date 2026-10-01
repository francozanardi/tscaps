/**
 * Grows the backing `Float32Array` only when a larger frame count is
 * requested, so repeated small-chunk reads reuse the same allocation
 * instead of thrashing the garbage collector.
 */
export class ReusableSampleBuffer {
  private buffer = new Float32Array(0);

  /**
   * Returns a subarray sized to hold exactly `frameCount` Float32
   * samples, growing the internal storage if the previous view was
   * shorter. The returned subarray is only valid until the next call.
   */
  viewOf(frameCount: number): Float32Array {
    if (this.buffer.length < frameCount) this.buffer = new Float32Array(frameCount);
    return this.buffer.subarray(0, frameCount);
  }
}
