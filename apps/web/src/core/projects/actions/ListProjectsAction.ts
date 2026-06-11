import type { ProjectMetadata } from '@core/projects/domain/ProjectMetadata';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';

/**
 * Returns the saved Projects in most-recently-updated order. The dashboard
 * uses this to render its grid of cards. Result is the lightweight metadata
 * projection — full payloads are loaded on demand by LoadProjectAction.
 */
export class ListProjectsAction {
  constructor(private readonly repository: ProjectRepository) {}

  execute(): Promise<ProjectMetadata[]> {
    return this.repository.list();
  }
}
