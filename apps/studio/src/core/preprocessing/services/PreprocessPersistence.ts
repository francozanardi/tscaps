import type { EditorState } from '@core/editor/domain/EditorState';
import type { CreateProjectAction, ProjectCreationOutcome } from '@core/projects/actions/CreateProjectAction';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import type { OriginalVideoKeeper } from '@core/videos/services/OriginalVideoKeeper';
import type { PreprocessingRun } from '@core/preprocessing/services/PreprocessingRun';
import { ProjectVideoStoreFailedError } from '@core/projects/domain/errors/ProjectVideoStoreFailedError';

/**
 * What a preprocessing run writes: an opening save that runs while
 * the pipeline works, a closing one that lands the finished document,
 * and — in every run, saved or not — a durable copy of the source
 * video.
 *
 * Both saves write the run's own project, from the run's own session,
 * wherever it lives. A reader can open another video while a run is
 * still transcribing or uploading, and the editor then holds a
 * different project; the run's session goes on in a store of its own,
 * where the project identity is stamped if it had none yet, and the
 * closing save lands on the run's project with the session as the run
 * finished it.
 *
 * Whether a run saves a project is settled when it starts, together
 * with the project's id (`projectIdFor`).
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
    private readonly createProject: CreateProjectAction,
    private readonly saveProject: SaveProjectAction,
    private readonly originalVideoKeeper: OriginalVideoKeeper,
    private readonly canPersist: () => boolean,
    private readonly newProjectId: () => string,
    private readonly saveFailureReporter: NonBlockingFailureReporter,
    private readonly videoStoreFailureReporter: NonBlockingFailureReporter,
    private readonly videoIsUploaded: boolean,
  ) {}

  /**
   * The project a run started on `state` saves: the one the session
   * already has, a fresh id when this session may save projects, or
   * `null` when it may not.
   */
  projectIdFor(state: EditorState): string | null {
    if (state.projectId !== null) return state.projectId;
    return this.canPersist() ? this.newProjectId() : null;
  }

  /**
   * Stamps the run's project identity (if needed) and starts the first
   * save, returning its still-running promise to hand back to
   * `finish`. Nothing awaits it until the pipeline is done, which can
   * be minutes away, so a rejection handler is attached here: without
   * one an early failure is an unhandled rejection, and `finish`
   * still observes the original rejection.
   */
  begin(run: PreprocessingRun): Promise<void> {
    const running = this.runInitialWrite(run);
    running.catch(() => undefined);
    return running;
  }

  /**
   * Awaits the opening save, then writes the run's project again so
   * the transcribed and tagged document lands in a single payload.
   * Resolves to `true` when the project row is durable, `false` when
   * persistence was skipped, either save failed, or the session holds
   * no document — a project with no document has nothing to add.
   */
  async finish(opening: Promise<void>, run: PreprocessingRun): Promise<boolean> {
    if (run.projectId === null || !this.canPersist()) return false;
    try {
      await opening;
      const finished = run.latestState();
      if (finished.document === null) return false;
      await this.saveProject.execute(finished);
      return true;
    } catch (cause) {
      console.error('[preprocess] auto-save after pipeline failed', cause);
      this.saveFailureReporter.report(cause);
      return false;
    }
  }

  /**
   * Resolves once the opening save is over, whichever way it went. For a
   * run that failed, whose project is kept unfinished: the failure the
   * reader already sees is the one worth telling, and a save that failed
   * too leaves a project whose video was never stored, which is not
   * listed.
   */
  async settle(opening: Promise<void>): Promise<void> {
    try {
      await opening;
    } catch {
      // Documented above: nothing to report on top of the run's failure.
    }
  }

  private async runInitialWrite(run: PreprocessingRun): Promise<void> {
    if (run.projectId === null) {
      await this.keepOriginalWithoutProject(run.videoFile);
      return;
    }
    const created = run.latestState().projectId === null
      ? await this.createProject.execute(run.projectId, () => run.store())
      : null;
    await this.saveProject.execute(run.latestState());
    this.reportVideoNotKept(created);
  }

  // A session with no project never promised to keep anything, so a
  // refused write leaves nothing to tell the reader about.
  private async keepOriginalWithoutProject(videoFile: File): Promise<void> {
    await this.originalVideoKeeper.keep(videoFile);
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
