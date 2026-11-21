/**
 * Raised when the `@font-face` rules the caption preview needs could not
 * be built for the sheets being edited.
 *
 * Reported rather than thrown, and never rendered, so not an `AppError`.
 * The rules already on the page stay, so the preview keeps drawing; at
 * worst a face the change introduced draws with a fallback font until the
 * next derivation builds the rules again.
 */
export class FontFaceRegistrationFailedError extends Error {
  override readonly name = 'FontFaceRegistrationFailedError';

  constructor(options?: { cause: unknown }) {
    super('The font rules for the caption preview could not be built', options);
  }
}
