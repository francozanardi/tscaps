import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';

/**
 * Re-attaches a freshly chosen video file to a project whose cached Blob
 * was evicted by the LRU policy. Used by the recovery prompt that the
 * editor route surfaces when LoadProjectAction returns
 * `videoRecovered: false`.
 *
 * Trusts the user that the file matches the project — we do not compare
 * size or fileName here. The risk of mismatch is low (the user is staring
 * at the project name and choosing a video) and a wrong file would only
 * misalign timings, which is recoverable by picking a different file.
 */
export class RecoverProjectVideoAction {
  constructor(
    private readonly store: EditorStore,
    private readonly repository: ProjectRepository,
  ) {}

  async execute(file: File): Promise<void> {
    const snap = this.store.snapshot();
    if (!snap.projectId) throw new Error('No project loaded');

    if (snap.video.url) URL.revokeObjectURL(snap.video.url);

    await this.repository.cacheVideoBlob(snap.projectId, file);

    this.store.patch({
      video: {
        file,
        url: URL.createObjectURL(file),
      },
      status: 'idle',
      error: null,
    });
  }
}
