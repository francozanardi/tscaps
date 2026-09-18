import { AppError } from '@core/errors/domain/AppError';

/**
 * Raised when the original video an operation needs could not be read
 * from any copy that might hold it: not the file the editor is
 * holding, not this device, not the server.
 *
 * `hasRemoteCopy` is the one distinction that changes the remedy — a
 * video kept on a server comes back on a reload, one that was only
 * ever in this browser has to be chosen again. It travels on the
 * error rather than being re-derived from the surface, because a
 * session with no project has no remote copy even where projects are
 * kept on one.
 */
export class OriginalVideoUnavailableError extends AppError {
  readonly name = 'OriginalVideoUnavailableError';

  readonly hasRemoteCopy: boolean;

  constructor(options: { hasRemoteCopy: boolean; cause?: unknown }) {
    super('Original video could not be read from any copy', options);
    this.hasRemoteCopy = options.hasRemoteCopy;
  }
}
