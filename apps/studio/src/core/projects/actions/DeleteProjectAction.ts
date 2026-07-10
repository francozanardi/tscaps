import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';

/**
 * Removes a Project record and its cached video Blob from storage. The
 * dashboard owns the call site; the editor does not surface deletion
 * because it cannot meaningfully continue editing a deleted project.
 */
export class DeleteProjectAction {
  constructor(private readonly repository: ProjectRepository) {}

  async execute(projectId: string): Promise<void> {
    await this.repository.delete(projectId);
  }
}
