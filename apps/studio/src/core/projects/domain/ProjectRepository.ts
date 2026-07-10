import type { Project } from '@core/projects/domain/Project';
import type { ProjectMetadata } from '@core/projects/domain/ProjectMetadata';

/**
 * Reports incremental progress of a `loadVideoBlob` fetch. `progress`
 * is the received fraction in `[0, 1]`, or `null` when the transport
 * could not advertise a content length and only an indeterminate
 * indicator can be rendered.
 */
export type LoadVideoBlobProgressCallback = (progress: number | null) => void;

/**
 * Persistence contract for Projects.
 *
 * Video Blob handling is exposed as separate methods because the cache is
 * LRU-bounded while the main project record persists indefinitely.
 * `save` does not touch the video blob; `cacheVideoBlob` does, and is the
 * sole entry point that may evict an older blob.
 *
 * `loadVideoBlob` accepts an optional progress callback and an
 * optional `AbortSignal`. Local implementations satisfied by a
 * synchronous cache may ignore both; remote-backed implementations
 * emit progress while the bytes stream in and honour the signal to
 * abort the in-flight fetch when the caller navigates away.
 */
export interface ProjectRepository {
  list(): Promise<ProjectMetadata[]>;
  load(id: string): Promise<Project | null>;
  has(id: string): Promise<boolean>;
  save(project: Project): Promise<void>;
  delete(id: string): Promise<void>;

  loadVideoBlob(
    projectId: string,
    onProgress?: LoadVideoBlobProgressCallback,
    signal?: AbortSignal,
  ): Promise<Blob | null>;
  cacheVideoBlob(projectId: string, blob: Blob): Promise<void>;
}
