/**
 * Raised when an animated image cannot be opened for reading frame by
 * frame: the browser has no decoder for it, its bytes are not of the
 * format, or not even its first frame decodes. Why is in `cause`.
 *
 * The `.name` string is set explicitly, and exposed as `ERROR_NAME` on
 * the class, so consumers can recognise the failure across a boundary
 * that preserves string fields but not class identity — a Worker, or a
 * browser driven from outside the page.
 */
export class AnimatedImageOpenFailedError extends Error {
  static readonly ERROR_NAME = 'AnimatedImageOpenFailedError';
  readonly name = AnimatedImageOpenFailedError.ERROR_NAME;
}
