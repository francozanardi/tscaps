import type { ProjectMetadata } from '@core/projects/domain/ProjectMetadata';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';

/**
 * Returns the saved Projects in most-recently-updated order. The dashboard
 * uses this to render its grid of cards. Result is the lightweight metadata
 * projection — full payloads are loaded on demand by LoadProjectAction.
 *
 * `prewarm()` fires the underlying `list` request eagerly and caches its
 * promise so that the next `execute()` returns the same in-flight or
 * resolved result without a second roundtrip. The cache is one-shot: it
 * clears itself the first time `execute()` consumes it, so later calls
 * always reflect fresh server state.
 */
export class ListProjectsAction {
  private prewarmed: Promise<ProjectMetadata[]> | null = null;

  constructor(private readonly repository: ProjectRepository) {}

  prewarm(): Promise<ProjectMetadata[]> {
    if (!this.prewarmed) {
      this.prewarmed = this.repository.list();
    }
    return this.prewarmed;
  }

  execute(): Promise<ProjectMetadata[]> {
    if (this.prewarmed) {
      const cached = this.prewarmed;
      this.prewarmed = null;
      return cached;
    }
    return this.repository.list();
  }
}
