import { AppError } from '@core/_shared/domain/AppError';

/**
 * Raised when writing a project out to its portable `.tscaps` archive
 * did not complete. Refers to the user-visible "Export project" action
 * on the dashboard, not to the video-export pipeline. The underlying
 * serializer / file-system / network error is preserved in `cause`.
 */
export class ProjectExportFailedError extends AppError {
  readonly name = 'ProjectExportFailedError';

  constructor(options: { cause: unknown }) {
    super('Project export failed', options);
  }
}
