import type { Project } from '@core/projects/domain/Project';
import type { ProjectMetadata } from '@core/projects/domain/ProjectMetadata';

/**
 * Persistence contract for Projects.
 *
 * Video Blob handling is exposed as separate methods because the cache is
 * LRU-bounded while the main project record persists indefinitely.
 * `save` does not touch the video blob; `cacheVideoBlob` does, and is the
 * sole entry point that may evict an older blob.
 */
export interface ProjectRepository {
  list(): Promise<ProjectMetadata[]>;
  load(id: string): Promise<Project | null>;
  has(id: string): Promise<boolean>;
  save(project: Project): Promise<void>;
  delete(id: string): Promise<void>;

  loadVideoBlob(projectId: string): Promise<Blob | null>;
  cacheVideoBlob(projectId: string, blob: Blob): Promise<void>;
}
