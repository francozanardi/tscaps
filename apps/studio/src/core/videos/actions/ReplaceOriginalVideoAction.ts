import type { EditorStore } from '@core/editor/store/EditorStore';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import type { OriginalVideoKeeper } from '@core/videos/services/OriginalVideoKeeper';
import { ProjectVideoStoreFailedError } from '@core/projects/domain/errors/ProjectVideoStoreFailedError';

/**
 * Whether the file that replaced the original is the same size as the
 * one the session started with. A different size proves it is a
 * different file; the same size proves nothing.
 */
export type ReplacedOriginalVideo = 'same-size' | 'different-size';

/**
 * Puts a freshly chosen file in place of an original the session can
 * no longer read. Only the bytes change: the document, the sheets and
 * every edit stay as they are, which is why this is not a video load.
 *
 * Trusts the reader that it is the same video, like the project
 * recovery prompt does — a different one only misaligns the timings.
 * Resolves to how the file compares with the one the session
 * committed to, so the caller can warn without blocking. Otherwise
 * the reader learns they picked the wrong video only after minutes of
 * rendering.
 */
export class ReplaceOriginalVideoAction {
  constructor(
    private readonly editorStore: EditorStore,
    private readonly keeper: OriginalVideoKeeper,
    private readonly storeFailureReporter: NonBlockingFailureReporter,
  ) {}

  async execute(file: File): Promise<ReplacedOriginalVideo> {
    const { video, projectId } = this.editorStore.snapshot();
    const comparison = this.compare(file, video.size);
    if (video.url) URL.revokeObjectURL(video.url);
    await this.keepCopyBestEffort(file, projectId !== null);
    this.editorStore.patch({
      video: {
        file,
        url: URL.createObjectURL(file),
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        // The preview was playing the bytes that went away, so it has
        // been showing nothing since.
        ...(video.preview?.kind === 'original' ? { preview: { ...video.preview, file } } : {}),
      },
      error: null,
    });
    return comparison;
  }

  private compare(file: File, originalSize: number | null): ReplacedOriginalVideo {
    if (originalSize === null || originalSize === file.size) return 'same-size';
    return 'different-size';
  }

  /**
   * Reaching this action means every stored copy came up empty, so a
   * project's next open will ask for the file again. A session with
   * no project promised no copy in the first place and says nothing.
   */
  private async keepCopyBestEffort(file: File, hasProject: boolean): Promise<void> {
    const failure = await this.keeper.keep(file);
    if (!failure || !hasProject) return;
    this.storeFailureReporter.report(new ProjectVideoStoreFailedError({ cause: failure, hasRemoteCopy: false }));
  }
}
