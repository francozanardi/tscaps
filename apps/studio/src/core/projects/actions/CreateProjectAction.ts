import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { ThumbnailGenerator } from '@core/projects/services/ThumbnailGenerator';

/**
 * Establishes a fresh project's identity on top of the currently
 * loaded video: stamps a new id, derives a name from the file name,
 * generates a thumbnail (best-effort), patches the editor store with
 * all of that, and caches the video bytes into the shared blob cache
 * so a later save can read them back.
 *
 * Idempotent at the call site: callers should check `state.projectId`
 * and skip if a project already exists.
 */
export class CreateProjectAction {
  constructor(
    private readonly store: EditorStore,
    private readonly repository: ProjectRepository,
    private readonly thumbnails: ThumbnailGenerator,
  ) {}

  async execute(): Promise<void> {
    const file = this.requireLoadedVideoFile();
    const thumbnail = await this.generateThumbnailBestEffort(file);
    const id = crypto.randomUUID();
    await this.repository.cacheVideoBlob(id, file);
    this.store.patch({
      projectId: id,
      projectName: this.deriveProjectName(file.name),
      projectCreatedAt: new Date(),
      projectThumbnail: thumbnail,
      dirty: true,
    });
  }

  private requireLoadedVideoFile(): File {
    const file = this.store.snapshot().video.file;
    if (!file) throw new Error('Cannot create project: no video file loaded');
    return file;
  }

  /**
   * Strips the file extension and trims whitespace. Falls back to
   * "Untitled" if the result is empty.
   */
  private deriveProjectName(fileName: string): string {
    const dot = fileName.lastIndexOf('.');
    const base = (dot > 0 ? fileName.slice(0, dot) : fileName).trim();
    return base.length > 0 ? base : 'Untitled';
  }

  private async generateThumbnailBestEffort(file: File): Promise<Blob | null> {
    try {
      return await this.thumbnails.generate(file);
    } catch {
      return null;
    }
  }
}
