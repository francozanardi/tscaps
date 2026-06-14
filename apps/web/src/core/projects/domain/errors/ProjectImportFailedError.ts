import { AppError } from '@core/_shared/domain/AppError';

/**
 * Raised when reading a project from a portable `.tscaps` archive
 * did not complete. Covers parse errors, schema mismatches, and any
 * storage failure while materializing the imported project. The
 * underlying error is preserved in `cause`.
 */
export class ProjectImportFailedError extends AppError {
  readonly name = 'ProjectImportFailedError';

  constructor(options: { cause: unknown }) {
    super('Project import failed', options);
  }
}
