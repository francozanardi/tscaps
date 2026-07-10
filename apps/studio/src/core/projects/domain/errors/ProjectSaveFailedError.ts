import { AppError } from '@core/_shared/domain/AppError';

/**
 * Raised when persisting the current project to its backing store
 * did not complete. Describes the save failure itself — the timing
 * within the preprocessing or export flow is not part of the error's
 * identity. The underlying repository / network error is preserved
 * in `cause`.
 */
export class ProjectSaveFailedError extends AppError {
  readonly name = 'ProjectSaveFailedError';

  constructor(options: { cause: unknown }) {
    super('Project save failed', options);
  }
}
