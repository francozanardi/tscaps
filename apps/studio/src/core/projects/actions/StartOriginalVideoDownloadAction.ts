import type { EditorStore } from '@core/editor/store/EditorStore';
import type { VideoState } from '@core/editor/domain/VideoState';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { OriginalVideoDownloadStore } from '@core/projects/store/OriginalVideoDownloadStore';

const FALLBACK_FILE_NAME = 'video';
const FALLBACK_MIME_TYPE = 'application/octet-stream';

/**
 * Fetches the active project's original video bytes from the project
 * repository and publishes them onto `editor.video.file` / `video.url`
 * when they land. Drives the {@link OriginalVideoDownloadStore} so UI
 * subscribers can render progress, a downloading badge, or a failure
 * banner.
 *
 * Skips silently when no project is loaded. Resolves the download
 * store to `'ready'` immediately when the bytes are already present
 * in the editor store, so callers can `await` this method without
 * branching on whether a fetch is actually needed.
 *
 * When an `AbortSignal` is supplied and fires while the fetch is in
 * flight, the network request aborts and neither the editor store
 * nor the download store are touched — the abort is treated as the
 * caller no longer needing the bytes, not as a failure.
 */
export class StartOriginalVideoDownloadAction {
  constructor(
    private readonly editorStore: EditorStore,
    private readonly downloadStore: OriginalVideoDownloadStore,
    private readonly repository: ProjectRepository,
  ) {}

  async execute(signal?: AbortSignal): Promise<void> {
    const snapshot = this.editorStore.snapshot();
    if (!snapshot.projectId) return;

    if (snapshot.video.file !== null) {
      this.downloadStore.markReady();
      return;
    }

    this.downloadStore.start();
    try {
      const blob = await this.repository.loadVideoBlob(
        snapshot.projectId,
        (progress) => this.downloadStore.setProgress(progress),
        signal,
      );
      if (signal?.aborted) return;
      if (!blob) {
        this.downloadStore.fail('network');
        return;
      }
      this.publishLoadedBlob(blob, snapshot.video);
      this.downloadStore.markReady();
    } catch (cause) {
      if (this.isAbort(cause, signal)) return;
      console.error('[original-video] download failed', cause);
      this.downloadStore.fail('network');
    }
  }

  private isAbort(error: unknown, signal: AbortSignal | undefined): boolean {
    if (signal?.aborted) return true;
    return error instanceof DOMException && error.name === 'AbortError';
  }

  private publishLoadedBlob(blob: Blob, video: VideoState): void {
    const file = this.toFile(blob, video);
    const url = URL.createObjectURL(file);
    this.editorStore.patchVideo({ file, url });
  }

  private toFile(blob: Blob, video: VideoState): File {
    return new File(
      [blob],
      video.fileName ?? FALLBACK_FILE_NAME,
      { type: video.mimeType ?? blob.type ?? FALLBACK_MIME_TYPE },
    );
  }
}
