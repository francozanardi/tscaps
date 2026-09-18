import type { EditorStore } from '@core/editor/store/EditorStore';
import type { CreateProjectAction, ProjectCreationOutcome } from '@core/projects/actions/CreateProjectAction';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import type { OriginalVideoKeeper } from '@core/videos/services/OriginalVideoKeeper';
import { ProjectVideoStoreFailedError } from '@core/projects/domain/errors/ProjectVideoStoreFailedError';

/**
 * What a preprocessing run writes: an opening save that runs while
 * the pipeline works, a closing one that lands the finished document,
 * and — in every run, saved or not — a durable copy of the source
 * video.
 *
 * The copy is unconditional because what it guards is this session
 * rather than the next one: a run that never becomes a project has no
 * other copy of the video to export from.
 *
 * A failure in either save is reported without being raised: the
 * document is finished and usable, and the editor opening is worth
 * more than a modal about bytes that did not reach disk.
 *
 * `videoIsUploaded` says whether this session's projects keep their
 * video on a server, which is what a notice about a video this device
 * would not keep needs in order to describe the next open.
 */
export class PreprocessPersistence {
  constructor(
    private readonly editorStore: EditorStore,
    private readonly createProject: CreateProjectAction,
    private readonly saveProject: SaveProjectAction,
    private readonly originalVideoKeeper: OriginalVideoKeeper,
    private readonly canPersist: () => boolean,
    private readonly saveFailureReporter: NonBlockingFailureReporter,
    private readonly videoStoreFailureReporter: NonBlockingFailureReporter,
    private readonly videoIsUploaded: boolean,
  ) {}

  /**
   * Stamps a fresh project identity (if needed) and starts the first
   * save, returning its still-running promise to hand back to
   * `finish`. Nothing awaits it until the pipeline is done, which can
   * be minutes away, so a rejection handler is attached here: without
   * one an early failure is an unhandled rejection, and `finish`
   * still observes the original rejection.
   */
  begin(): Promise<void> {
    const running = this.runInitialWrite();
    running.catch(() => undefined);
    return running;
  }

  /**
   * Awaits the opening save, then writes the project again so the
   * transcribed and tagged document lands in a single payload.
   * Resolves to `true` when the project row is durable, `false` when
   * persistence was skipped or either save failed.
   */
  async finish(opening: Promise<void>): Promise<boolean> {
    if (!this.canPersist()) return false;
    try {
      await opening;
      await this.saveProject.execute();
      return true;
    } catch (cause) {
      console.error('[preprocess] auto-save after pipeline failed', cause);
      this.saveFailureReporter.report(cause);
      return false;
    }
  }

  private async runInitialWrite(): Promise<void> {
    if (!this.canPersist()) {
      await this.keepOriginalWithoutProject();
      return;
    }
    const created = this.editorStore.snapshot().projectId === null
      ? await this.createProject.execute()
      : null;
    await this.saveProject.execute();
    this.reportVideoNotKept(created);
  }

  // A session with no project never promised to keep anything, so a
  // refused write leaves nothing to tell the reader about.
  private async keepOriginalWithoutProject(): Promise<void> {
    const file = this.editorStore.snapshot().video.file;
    if (file) await this.originalVideoKeeper.keep(file);
  }

  /**
   * Announces a video the device would not keep, and only once the
   * project it belongs to is on disk. A project that never landed has
   * no next open to warn anyone about, and the failed save says the
   * larger thing already.
   */
  private reportVideoNotKept(created: ProjectCreationOutcome | null): void {
    if (!created?.videoStoreFailure) return;
    this.videoStoreFailureReporter.report(
      new ProjectVideoStoreFailedError({
        cause: created.videoStoreFailure,
        hasRemoteCopy: this.videoIsUploaded,
      }),
    );
  }
}
