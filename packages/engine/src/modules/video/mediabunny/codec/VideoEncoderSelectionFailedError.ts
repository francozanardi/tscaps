/**
 * Raised when the browser has no encoder for any of the video codecs
 * the requested output format accepts, so the render cannot produce a
 * file at all. Fired before any frame is rendered.
 *
 * The `.name` string is set explicitly, and exposed as `ERROR_NAME` on
 * the class, so consumers can recognise the failure across a boundary
 * that preserves string fields but not class identity — a Worker, or a
 * browser driven from outside the page.
 */
export class VideoEncoderSelectionFailedError extends Error {
  static readonly ERROR_NAME = 'VideoEncoderSelectionFailedError';
  readonly name = VideoEncoderSelectionFailedError.ERROR_NAME;
}
