import { AppError } from '@core/errors/domain/AppError';

/**
 * Raised when the subtitle file a run was handed could not be turned
 * into captions at all.
 *
 * Names what the reader was trying to do rather than what was wrong
 * with the file; which of the several ways a caption file can be
 * unreadable applies is preserved in `cause`.
 */
export class SubtitleFileReadFailedError extends AppError {
  readonly name = 'SubtitleFileReadFailedError';

  constructor(options: { cause: unknown }) {
    super('Subtitle file could not be read', options);
  }
}
