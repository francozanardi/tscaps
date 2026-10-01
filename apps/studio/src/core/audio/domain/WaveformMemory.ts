/**
 * Somewhere a waveform worked out as a by-product — by a decode that was
 * running for another reason — can be left for whoever asks for the same
 * source next, so it is not decoded again.
 */
export interface WaveformMemory {
  /**
   * Records `peaks` as the envelope of `source` at `peaksPerSecond`. The
   * envelope follows the contract of `WaveformExtractor.extract`.
   */
  remember(source: Blob, peaksPerSecond: number, peaks: Float32Array): void;
}
