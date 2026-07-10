import { AppError } from '@core/_shared/domain/AppError';

/**
 * Raised when an export run could not produce a finished output
 * file. Covers failures originating in the renderer, the encoder,
 * or the output writer once the run has been committed to. The
 * underlying engine or browser error is preserved in `cause` so
 * support tooling can inspect the actual failure mode.
 */
export class ExportFailedError extends AppError {
  readonly name = 'ExportFailedError';

  constructor(options: { cause: unknown }) {
    super('Export failed', options);
  }
}
