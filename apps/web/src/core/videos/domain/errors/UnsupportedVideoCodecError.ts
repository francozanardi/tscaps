import { AppError } from '@core/_shared/domain/AppError';

/**
 * Raised when the source video uses a codec the current browser
 * cannot decode (e.g. HEVC on Firefox). Carries the offending codec
 * name so callers can surface it to the user.
 */
export class UnsupportedVideoCodecError extends AppError {
  readonly name = 'UnsupportedVideoCodecError';
  readonly codec: string;

  constructor(options: { codec: string; cause?: unknown }) {
    super(`Unsupported video codec: ${options.codec}`, { cause: options.cause });
    this.codec = options.codec;
  }
}
