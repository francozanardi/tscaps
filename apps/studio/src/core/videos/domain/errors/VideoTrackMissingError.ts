import { AppError } from '@core/errors/domain/AppError';

/**
 * Raised when the source file carries no video track — an audio file,
 * or a container whose video track cannot be found. Distinct from
 * `UnsupportedVideoCodecError`: nothing is wrong with the browser and
 * re-encoding the file would not help; the file is the wrong kind.
 */
export class VideoTrackMissingError extends AppError {
  readonly name = 'VideoTrackMissingError';

  constructor(options?: { cause?: unknown }) {
    super('The source has no video track', { cause: options?.cause });
  }
}
