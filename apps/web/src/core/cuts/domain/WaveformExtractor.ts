/**
 * Port for extracting a downsampled peak envelope from a media file's
 * primary audio track. Implementations must stream samples from the
 * source so peak memory use stays proportional to a single decode
 * chunk, independent of the source's total length or size.
 */
export interface WaveformExtractor {
  /**
   * Returns one peak per bucket, where each bucket spans
   * `1 / peaksPerSecond` seconds of source time and stores the maximum
   * absolute sample amplitude in `[0, 1]` observed inside that window.
   *
   * A `source` with no decodable audio track resolves to an empty
   * `Float32Array` — no throw, so callers can treat "no waveform" as a
   * displayable state rather than an error.
   *
   * When the source has multiple audio channels, only the first
   * channel is inspected; callers that need mixed output must mix
   * upstream.
   */
  extract(source: Blob, peaksPerSecond: number): Promise<Float32Array>;
}
