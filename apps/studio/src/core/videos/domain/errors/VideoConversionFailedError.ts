import { AppError } from '@core/errors/domain/AppError';

/**
 * Raised when converting a video the browser cannot decode into one it
 * can did not finish. Why it stopped is on `cause`.
 */
export class VideoConversionFailedError extends AppError {
  readonly name = 'VideoConversionFailedError';

  constructor(options: { cause?: unknown } = {}) {
    super('Converting the video in the browser failed', { cause: options.cause });
  }
}
