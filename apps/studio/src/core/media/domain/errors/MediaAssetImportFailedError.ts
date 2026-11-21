import { AppError } from '@core/errors/domain/AppError';

/**
 * Raised when a file could not be added: it is not a kind of file the
 * editor takes, it is too large or too long for its kind, it could not
 * be read, or its bytes could not be kept. The reason is preserved in
 * `cause`.
 */
export class MediaAssetImportFailedError extends AppError {
  readonly name = 'MediaAssetImportFailedError';

  constructor(options: { cause: unknown }) {
    super('Adding a media file failed', options);
  }
}
