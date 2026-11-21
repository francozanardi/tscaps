import type { EditorStore } from '@core/editor/store/EditorStore';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { OriginalVideoResolver } from '@core/videos/services/OriginalVideoResolver';
import type { VideoBlobMissReason, VideoBlobSource } from '@core/videos/domain/VideoBlobLookup';
import { OriginalVideoUnavailableError } from '@core/videos/domain/errors/OriginalVideoUnavailableError';

/**
 * Puts readable bytes back behind a preview whose original stopped
 * reading while it played.
 *
 * The preview of a fresh import plays the file the reader picked, and
 * a picked file does not stay readable: moved, changed or deleted on
 * disk, evicted by a syncing folder, or taken back by the system. The
 * same video is usually still in another copy, so the action looks
 * for one the way the export does — a download in flight, this device,
 * then the server — and, when one answers, makes it what the preview
 * and the editor hold. The preview loads it again where it was.
 *
 * When no copy answers, `video.sourceUnavailable` carries an
 * {@link OriginalVideoUnavailableError} for the player to explain, and
 * the reader picks the file again or reloads.
 *
 * A copy this action put in place that stops reading too is not
 * looked past again: the copies were already tried, so it goes
 * straight to unavailable rather than round again.
 *
 * Does nothing when the preview is not playing the original, and
 * leaves the editor alone when another video took its place while the
 * copies were being looked for. Never rejects.
 */
export class RecoverPreviewSourceAction {
  private running = false;
  private recoveredFile: Blob | null = null;

  constructor(
    private readonly editorStore: EditorStore,
    private readonly resolver: OriginalVideoResolver,
    private readonly telemetry: Telemetry,
    private readonly videoIsUploaded: boolean,
  ) {}

  async execute(): Promise<void> {
    const { preview } = this.editorStore.snapshot().video;
    if (this.running || preview?.kind !== 'original') return;
    this.running = true;
    try {
      await this.recover(preview.file);
    } catch (cause) {
      // The reader is already looking at a preview that stopped; a
      // failure to look for another copy leaves it as unavailable as a
      // search that found none.
      console.error('[preview] looking for another copy of the original failed', cause);
      this.markUnavailable(preview.file, 'lookup-failed');
    } finally {
      this.running = false;
    }
  }

  private async recover(failedFile: Blob): Promise<void> {
    if (failedFile === this.recoveredFile) {
      this.markUnavailable(failedFile, 'stored-bytes-gone');
      return;
    }
    const resolution = await this.resolver.readableFileFromStorage();
    if (resolution.outcome === 'missing') {
      this.markUnavailable(failedFile, resolution.reason);
      return;
    }
    if (!this.stillPreviewing(failedFile)) return;
    this.replaceSource(failedFile, resolution.file);
    this.reportRecovered(resolution.source);
  }

  /** Plays `file` in place of `failedFile`, and holds it as the original too when that is what went away. */
  private replaceSource(failedFile: Blob, file: File): void {
    const { video } = this.editorStore.snapshot();
    const originalWentAway = video.file === failedFile;
    if (originalWentAway && video.url) URL.revokeObjectURL(video.url);
    this.editorStore.patchVideo({
      ...(originalWentAway ? { file, url: URL.createObjectURL(file) } : {}),
      preview: video.preview?.kind === 'original' ? { ...video.preview, file } : video.preview,
      sourceUnavailable: null,
    });
    this.recoveredFile = file;
  }

  private markUnavailable(failedFile: Blob, reason: VideoBlobMissReason | 'lookup-failed'): void {
    if (!this.stillPreviewing(failedFile)) return;
    const hasRemoteCopy = this.hasRemoteCopy();
    this.editorStore.patchVideo({ sourceUnavailable: new OriginalVideoUnavailableError({ hasRemoteCopy }) });
    this.telemetry.capture('original_video_unavailable', {
      context: 'preview',
      reason,
      has_remote_copy: hasRemoteCopy,
    });
  }

  private reportRecovered(source: VideoBlobSource): void {
    this.telemetry.capture('original_video_recovered', { context: 'preview', video_source: source });
  }

  private stillPreviewing(file: Blob): boolean {
    const { preview } = this.editorStore.snapshot().video;
    return preview?.kind === 'original' && preview.file === file;
  }

  // Both halves are required: a session that keeps no project has
  // nothing on a server, whatever this build does with the ones that do.
  private hasRemoteCopy(): boolean {
    return this.videoIsUploaded && this.editorStore.snapshot().projectId !== null;
  }
}
