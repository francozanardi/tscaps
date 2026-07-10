/**
 * Verifies that the current browser can process a source media blob
 * end-to-end through the preview pipeline:
 *
 * - the video codec is decodable, so the source can be read at all,
 * - an H.264 encoder is available so the proxy can be produced,
 * - the audio codec (when present) can be either copied verbatim or
 *   re-encoded into a codec the proxy container accepts.
 *
 * Throws `UnsupportedVideoCodecError` or `UnsupportedAudioCodecError`
 * with the offending codec name on the first failed check. Returns
 * without error when the input is fully processable. Designed to be
 * called once, upfront, before any heavy work (transcribe upload,
 * proxy generation, R2 upload) so the user finds out about a
 * blocker before any time has been spent.
 */
export interface VideoCompatibilityChecker {
  check(source: Blob): Promise<void>;
}
