import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { ProjectName } from '@core/projects/domain/ProjectName';
import type { ThumbnailGenerator } from '@core/projects/services/ThumbnailGenerator';
/**
 * Outcome of {@link CreateProjectAction.execute}.
 *
 * `videoStoreFailure` carries what stopped this device from keeping a
 * copy of the video, or `null` when it kept one or no project was
 * established. Whether that failure is worth telling anyone depends on
 * what happens to the project afterwards, which the caller knows and
 * this action does not.
 */
export interface ProjectCreationOutcome {
  readonly videoStoreFailure: unknown | null;
}

/**
 * Establishes a fresh project's identity on top of the video an editor
 * session holds: stamps the id it is handed, derives a name from the
 * file name, generates a thumbnail (best-effort), patches the session's
 * store with all of that, and caches the video bytes into the shared
 * blob cache so a later save can read them back. The id comes from the
 * caller, which can name the project elsewhere before it exists here.
 *
 * Idempotent at the call site: callers should check `state.projectId`
 * and skip if a project already exists.
 *
 * `sessionStore` returns the store that holds the session, and is asked
 * again once the thumbnail and the copy are written: a session can
 * leave the editor for a store of its own meanwhile, and the identity
 * is stamped where the session is by then. When that store no longer
 * shows the video (another video was opened in it, or another project
 * started loading), nothing is stamped: stamping it there would save
 * the wrong video under it. The copy kept for it is dropped again.
 *
 * Caching the video writes the largest thing the app ever stores, so
 * it is the step that fails for real-world reasons. It is handed back
 * and not raised: the bytes remain reachable through the cache's
 * in-memory tier, which is what a session with no room left on disk
 * still uploads from, and refusing to establish the project would
 * only take the reader's work away for a copy nothing needs yet.
 */
export class CreateProjectAction {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly thumbnails: ThumbnailGenerator,
    private readonly projectName: ProjectName,
  ) {}

  async execute(projectId: string, sessionStore: () => EditorStore): Promise<ProjectCreationOutcome> {
    const file = this.requireLoadedVideoFile(sessionStore());
    const thumbnail = await this.generateThumbnailBestEffort(file);
    const videoStoreFailure = await this.cacheVideoBlobBestEffort(projectId, file);
    const store = sessionStore();
    if (!store.isShowing(file)) {
      await this.dropCachedVideoBestEffort(projectId);
      return { videoStoreFailure: null };
    }
    store.patch({
      projectId,
      projectName: this.deriveProjectName(file.name),
      projectCreatedAt: new Date(),
      projectThumbnail: thumbnail,
      dirty: true,
    });
    return { videoStoreFailure };
  }

  /**
   * The bytes stay reachable for the rest of the session whether or
   * not this device could keep them, so a refused write is not a
   * reason to leave the reader without a project. Resolves to what
   * refused the write, or `null` when it went through.
   */
  private async cacheVideoBlobBestEffort(id: string, file: File): Promise<unknown | null> {
    try {
      await this.repository.cacheVideoBlob(id, file);
      return null;
    } catch (cause) {
      return cause;
    }
  }

  private async dropCachedVideoBestEffort(id: string): Promise<void> {
    try {
      await this.repository.delete(id);
    } catch {
      // Nothing refers to the copy: a failure to drop it leaves bytes
      // the browser may evict, and no project depends on them.
    }
  }

  private requireLoadedVideoFile(store: EditorStore): File {
    const file = store.snapshot().video.file;
    if (!file) throw new Error('Cannot create project: no video file loaded');
    return file;
  }

  /**
   * Strips the file extension and clamps the result through
   * `ProjectName`, so a long filename lands as a truncated project
   * name rather than being rejected on the first save.
   */
  private deriveProjectName(fileName: string): string {
    const dot = fileName.lastIndexOf('.');
    const base = dot > 0 ? fileName.slice(0, dot) : fileName;
    return this.projectName.clamp(base);
  }

  private async generateThumbnailBestEffort(file: File): Promise<Blob | null> {
    try {
      return await this.thumbnails.generate(file);
    } catch {
      return null;
    }
  }
}
