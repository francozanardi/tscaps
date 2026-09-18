import type { BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { OriginalVideoDownloadStore } from '@core/projects/store/OriginalVideoDownloadStore';
import type { OriginalVideoKeeper } from '@core/videos/services/OriginalVideoKeeper';
import type { VideoBlobMissReason, VideoBlobSource } from '@core/videos/domain/VideoBlobLookup';

/** Readable original bytes and which copy answered, or why none could. */
export type OriginalVideoResolution =
  | { readonly outcome: 'found'; readonly file: File; readonly source: VideoBlobSource }
  | { readonly outcome: 'missing'; readonly reason: VideoBlobMissReason };

/**
 * Finds bytes of the original the editor is working on that can
 * actually be read.
 *
 * Split in two because the costs are nothing alike: reading what the
 * editor already holds is a one-byte probe, and going to storage may
 * wait on a download. Callers take the first when it answers, and
 * only then decide what to show while the second runs.
 *
 * The probe is what the whole class is for. The file the editor holds
 * is usually the one the reader picked, and a picked file does not
 * stay readable — on iOS and iPadOS the system deletes the copy it
 * handed the page, so an export an hour later reads nothing while the
 * same video sits intact in storage.
 */
export class OriginalVideoResolver {
  constructor(
    private readonly editorStore: EditorStore,
    private readonly probe: BlobReadabilityProbe,
    private readonly keeper: OriginalVideoKeeper,
    private readonly downloadStore: OriginalVideoDownloadStore,
  ) {}

  /** The file the editor holds, or `null` when it holds none or that one will not read. */
  async readableFileInEditor(): Promise<File | null> {
    const file = this.editorStore.snapshot().video.file;
    if (file === null) return null;
    try {
      return await this.probe.probe(file) === 'readable' ? file : null;
    } catch (cause) {
      // Any failure to read means the same thing to every caller, and
      // raising here would land in the middle of an export that has
      // already opened its writer.
      console.warn('[original-video] reading the file the editor holds failed', cause);
      return null;
    }
  }

  /**
   * The durable copy: a download already in flight, then this device,
   * then the server when the session has a project kept on one.
   *
   * Rejects when a download in flight settles as failed — that
   * failure has its own banner, and reporting a missing video instead
   * would send the reader looking for the wrong thing.
   */
  async readableFileFromStorage(): Promise<OriginalVideoResolution> {
    const downloaded = await this.awaitDownloadedFile();
    if (downloaded) return { outcome: 'found', file: downloaded, source: 'memory' };

    const hadFileInEditor = this.editorStore.snapshot().video.file !== null;
    const stored = await this.keeper.storedCopy();
    if (stored.outcome === 'missing') {
      return { outcome: 'missing', reason: this.refine(stored.reason, hadFileInEditor) };
    }
    return { outcome: 'found', file: this.toFile(stored.blob), source: stored.source };
  }

  // Waiting on a store that never started never resolves, and a
  // session with no project never starts a fetch at all.
  private async awaitDownloadedFile(): Promise<File | null> {
    if (this.downloadStore.status.kind === 'idle') return null;
    await this.downloadStore.waitUntilReady();
    return this.readableFileInEditor();
  }

  /**
   * A copy that was never kept is the whole story only when the
   * editor had nothing either. When it was holding a file, that file
   * going away is what happened, and the reader is told so.
   */
  private refine(reason: VideoBlobMissReason, hadFileInEditor: boolean): VideoBlobMissReason {
    return reason === 'absent' && hadFileInEditor ? 'held-file-gone' : reason;
  }

  private toFile(blob: Blob): File {
    const { video } = this.editorStore.snapshot();
    return new File([blob], video.fileName ?? 'video', { type: video.mimeType ?? blob.type });
  }
}
