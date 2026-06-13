import { AppError } from '@core/_shared/domain/AppError';

/**
 * Raised when deleting a project from its backing store did not
 * complete. The underlying repository / network error is preserved
 * in `cause`.
 */
export class ProjectDeleteFailedError extends AppError {
  readonly name = 'ProjectDeleteFailedError';

  constructor(options: { cause: unknown }) {
    super('Project delete failed', options);
  }
}
