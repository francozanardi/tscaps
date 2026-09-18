import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { VideoBlobCache } from '@core/videos/domain/VideoBlobCache';
import type { VideoBlobLookup } from '@core/videos/domain/VideoBlobLookup';

/**
 * Custody of the durable copy of the original the session is editing:
 * where it goes, and where it comes back from.
 *
 * A session with no project keeps one too, not so it can be reopened
 * — nothing ever will — but because the picked `File` is otherwise
 * the only copy, and on iOS and iPadOS the system deletes the copy it
 * handed the page while that page is still open.
 */
export class OriginalVideoKeeper {
  private unsavedCopyId: string | null = null;

  constructor(
    private readonly editorStore: EditorStore,
    private readonly blobCache: VideoBlobCache,
    private readonly projects: ProjectRepository,
  ) {}

  /**
   * Best-effort: resolves to what refused the write, or `null` when it
   * went through. A device with no room left still edits and exports
   * from the file in hand.
   */
  async keep(blob: Blob): Promise<unknown | null> {
    try {
      await this.write(blob);
      return null;
    } catch (cause) {
      return cause;
    }
  }

  storedCopy(): Promise<VideoBlobLookup> {
    const projectId = this.projectId();
    if (projectId !== null) return this.projects.loadVideoBlob(projectId);
    if (this.unsavedCopyId === null) return Promise.resolve({ outcome: 'missing', reason: 'absent' });
    return this.blobCache.load(this.unsavedCopyId);
  }

  // A project's copy goes through the repository because a repository
  // that syncs reads the bytes back out of this write to upload them.
  private async write(blob: Blob): Promise<void> {
    const projectId = this.projectId();
    if (projectId !== null) {
      await this.projects.cacheVideoBlob(projectId, blob);
      return;
    }
    const id = this.unsavedCopyId ?? crypto.randomUUID();
    await this.blobCache.store(id, blob);
    this.unsavedCopyId = id;
  }

  private projectId(): string | null {
    return this.editorStore.snapshot().projectId;
  }
}
