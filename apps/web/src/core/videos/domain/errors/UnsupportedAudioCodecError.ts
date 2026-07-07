import { AppError } from '@core/_shared/domain/AppError';

/**
 * Raised when the source audio cannot be carried into the preview
 * proxy: either the browser cannot decode the source codec, or
 * there is no proxy-container-compatible codec the browser can
 * encode. Carries the offending codec name for user-facing copy.
 */
export class UnsupportedAudioCodecError extends AppError {
  readonly name = 'UnsupportedAudioCodecError';
  readonly codec: string;

  constructor(options: { codec: string; cause?: unknown }) {
    super(`Unsupported audio codec: ${options.codec}`, { cause: options.cause });
    this.codec = options.codec;
  }
}
