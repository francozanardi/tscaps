import { AppError } from '@core/_shared/domain/AppError';

/**
 * Raised when the projects index could not be retrieved from its
 * backing store. Describes the load failure itself — the underlying
 * repository / network error is preserved in `cause` so support
 * tooling can inspect the actual failure mode.
 */
export class ProjectListLoadFailedError extends AppError {
  readonly name = 'ProjectListLoadFailedError';

  constructor(options: { cause: unknown }) {
    super('Project list load failed', options);
  }
}
