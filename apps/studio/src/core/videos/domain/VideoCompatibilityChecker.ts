/**
 * Verifies that the current browser can read a source media blob
 * end-to-end through the preview pipeline:
 *
 * - the file carries a video track at all,
 * - its video codec is decodable, proven by decoding a real frame,
 * - the audio codec (when present) can be either copied verbatim or
 *   re-encoded into a codec the proxy container accepts.
 *
 * Throws `VideoTrackMissingError`, `UnsupportedVideoCodecError` or
 * `UnsupportedAudioCodecError` on the first failed check, the codec
 * ones carrying the offending codec name. Returns without error when
 * the input is fully readable. Designed to be called once, upfront,
 * before any heavy work (transcribe upload, proxy generation, R2
 * upload) so the user finds out about a blocker before any time has
 * been spent.
 *
 * Scoped to reading the source. Whether this browser can *write* a
 * finished export is a property of the browser rather than of the
 * file, and is asked separately through `VideoExportSupport`.
 */
export interface VideoCompatibilityChecker {
  check(source: Blob): Promise<void>;
}
