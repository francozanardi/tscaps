import { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import { Project } from '@core/projects/domain/Project';
import { ProjectMetadata } from '@core/projects/domain/ProjectMetadata';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import { ProjectSerializer, type SerializedProject } from '@core/projects/services/ProjectSerializer';
import type { VideoBlobCache } from '@core/videos/domain/VideoBlobCache';

const STORE = 'projects';

interface ProjectsRecord {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly thumbnail: Blob | null;
  readonly hasDocument: boolean;
  readonly payload: SerializedProject;
  readonly videoFileName: string;
  readonly videoMimeType: string;
  readonly videoSize: number;
  readonly videoDuration: number;
}

/**
 * Browser-side `ProjectRepository`. Stores the full project record
 * (metadata + serialised payload + thumbnail) in the `projects`
 * IndexedDB store; the video bytes themselves go through the
 * injected `VideoBlobCache` so its LRU policy can evict large blobs
 * without touching project records.
 *
 * Connection lifecycle is owned by the shared `IndexedDbClient`; this
 * class only knows how to read and write its own store.
 */
export class IndexedDbProjectRepository implements ProjectRepository {
  constructor(
    private readonly db: IndexedDbClient,
    private readonly serializer: ProjectSerializer,
    private readonly videoBlobCache: VideoBlobCache,
  ) {}

  async list(): Promise<ProjectMetadata[]> {
    const records = await this.db.readAll<ProjectsRecord>(STORE);
    return records
      .map((r) => this.recordToMetadata(r))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async load(id: string): Promise<Project | null> {
    const record = await this.db.readOne<ProjectsRecord>(STORE, id);
    if (!record) return null;
    return this.serializer.deserialize(record.payload, record.thumbnail);
  }

  async has(id: string): Promise<boolean> {
    const record = await this.db.readOne<ProjectsRecord>(STORE, id);
    return record !== null;
  }

  async save(project: Project): Promise<void> {
    const record: ProjectsRecord = {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      thumbnail: project.thumbnail,
      hasDocument: project.document !== null,
      payload: this.serializer.serialize(project),
      videoFileName: project.video.fileName,
      videoMimeType: project.video.mimeType,
      videoSize: project.video.size,
      videoDuration: project.video.duration,
    };
    await this.db.writeOne(STORE, record);
  }

  async delete(id: string): Promise<void> {
    await this.db.deleteOne(STORE, id);
    await this.videoBlobCache.delete(id);
  }

  loadVideoBlob(projectId: string): Promise<Blob | null> {
    // The local cache resolves in one IndexedDB round-trip, so neither
    // the progress hook nor the abort signal have anything to observe.
    return this.videoBlobCache.load(projectId);
  }

  cacheVideoBlob(projectId: string, blob: Blob): Promise<void> {
    return this.videoBlobCache.store(projectId, blob);
  }

  private recordToMetadata(record: ProjectsRecord): ProjectMetadata {
    return new ProjectMetadata(
      record.id,
      record.name,
      new Date(record.createdAt),
      new Date(record.updatedAt),
      {
        fileName: record.videoFileName,
        mimeType: record.videoMimeType,
        size: record.videoSize,
        duration: record.videoDuration,
      },
      record.thumbnail ? { kind: 'blob', blob: record.thumbnail } : null,
      record.hasDocument,
    );
  }
}
