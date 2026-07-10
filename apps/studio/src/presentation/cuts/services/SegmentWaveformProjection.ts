/**
 * Projects a slice of raw audio peaks into a fixed-size bar-chart
 * shape suitable for a per-segment waveform view. The projection
 * answers two presentation concerns at once: which peaks fall inside
 * the requested time window, and how to downsample them so that long
 * segments don't outrun the renderer with one bar per peak.
 *
 * The output is a normalized peak per bar (0..1). The consuming view
 * decides how to draw it (SVG path, canvas strokes, etc.).
 */
export class SegmentWaveformProjection {

  constructor(private readonly targetBarCount: number = 300) {}

  bars(peaks: Float32Array, peaksPerSecond: number, startSec: number, endSec: number): Float32Array {
    const slice = this.sliceFor(peaks, peaksPerSecond, startSec, endSec);
    return this.downsample(slice, this.targetBarCount);
  }

  private sliceFor(
    peaks: Float32Array,
    peaksPerSecond: number,
    startSec: number,
    endSec: number,
  ): Float32Array {
    const startIndex = Math.max(0, Math.floor(startSec * peaksPerSecond));
    const endIndex = Math.min(peaks.length, Math.ceil(endSec * peaksPerSecond));
    if (endIndex <= startIndex) return new Float32Array(0);
    return peaks.subarray(startIndex, endIndex);
  }

  private downsample(slice: Float32Array, targetCount: number): Float32Array {
    if (slice.length <= targetCount) return slice;
    const stride = Math.ceil(slice.length / targetCount);
    const result = new Float32Array(Math.ceil(slice.length / stride));
    for (let i = 0; i < result.length; i++) {
      const start = i * stride;
      const end = Math.min(slice.length, start + stride);
      let peak = 0;
      for (let j = start; j < end; j++) {
        const abs = slice[j]!;
        if (abs > peak) peak = abs;
      }
      result[i] = peak;
    }
    return result;
  }
}
