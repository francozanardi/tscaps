import { AppError } from '@core/errors/domain/AppError';

/**
 * Raised when a file could not be given to a project or to the
 * library: the move was refused, or did not reach where the list of
 * files is kept. The file stays where it was. The reason is preserved in
 * `cause`.
 */
export class MediaAssetMoveFailedError extends AppError {
  readonly name = 'MediaAssetMoveFailedError';

  constructor(options: { cause: unknown }) {
    super('Moving a media file failed', options);
  }
}
