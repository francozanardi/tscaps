/**
 * Raised when a decoder stops partway through reading a track: a frame
 * it was handed could not be turned into pixels. The browser's own
 * error travels in `cause`.
 *
 * `decodedUntilSec` is the presentation time up to which every frame of
 * the read came out — the end of the last frame yielded, or the start
 * of the span when not one was. Whatever stopped the decoder sits at or
 * just after it, which is what tells a stream that is unreadable from
 * some point on apart from one refused outright.
 *
 * The `.name` string is set explicitly, and exposed as `ERROR_NAME` on
 * the class, so consumers can recognise the failure across a boundary
 * that preserves string fields but not class identity.
 */
export class VideoFrameDecodeFailedError extends Error {
  static readonly ERROR_NAME = 'VideoFrameDecodeFailedError';
  readonly name = VideoFrameDecodeFailedError.ERROR_NAME;

  constructor(readonly decodedUntilSec: number, options: { cause: unknown }) {
    super(`Decoding stopped after ${decodedUntilSec.toFixed(3)}s of the video track`, options);
  }
}
