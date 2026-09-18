/**
 * Raised when a project id has no record behind it.
 *
 * Not an `AppError` and never rendered on its own: it travels as the
 * `cause` of whichever operation ran into it, which is what lets it
 * name a condition instead of an operation. The rendering boundary
 * reaches it through `FailureReason`.
 */
export class ProjectNotFoundError extends Error {
  static readonly ERROR_NAME = 'ProjectNotFoundError';

  override readonly name = ProjectNotFoundError.ERROR_NAME;

  constructor(projectId: string) {
    super(`Project not found: ${projectId}`);
  }
}
