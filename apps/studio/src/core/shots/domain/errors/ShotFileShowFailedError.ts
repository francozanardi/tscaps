import { AppError } from '@core/errors/domain/AppError';

/**
 * Raised when a file could not be shown on a shot — added to it, or put
 * in place of a layer's file — because this browser cannot play it: a
 * GIF no decoder here can read. Why it cannot is preserved in `cause`.
 */
export class ShotFileShowFailedError extends AppError {
  readonly name = 'ShotFileShowFailedError';

  constructor(mediaId: string, options: { cause: unknown }) {
    super(`Showing the file ${mediaId} on a shot failed`, options);
  }
}
