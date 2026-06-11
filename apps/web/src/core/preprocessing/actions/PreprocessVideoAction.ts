import type { TranscriberOptions } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { TranscribeAction } from '@core/transcription/actions/TranscribeAction';
import type { RunTaggersAction } from '@core/tagging/actions/RunTaggersAction';
import type { ApplyMultipleSpeakersAction } from '@core/preprocessing/actions/ApplyMultipleSpeakersAction';
import type { CreateProjectAction } from '@core/projects/actions/CreateProjectAction';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';

export interface PreprocessVideoOptions {
  readonly transcriber?: TranscriberOptions;
  readonly multipleSpeakers: boolean;
}

/**
 * Entry point for the editor's preprocessing pipeline. Wraps the
 * full initial pass over a freshly loaded video: transcribes it,
 * runs the platform's semantic taggers over the resulting document,
 * derives the visible document, and persists the project. Sets the
 * editor's `status` and `error` fields around the run and emits
 * `preprocessing_*` telemetry so each phase is observable end to end.
 *
 * Persistence is gated by the supplied `canPersist` callback.
 */
export class PreprocessVideoAction {
  constructor(
    private readonly store: EditorStore,
    private readonly transcribe: TranscribeAction,
    private readonly runTaggers: RunTaggersAction,
    private readonly applyMultipleSpeakers: ApplyMultipleSpeakersAction,
    private readonly refresh: RefreshDocumentAction,
    private readonly createProject: CreateProjectAction,
    private readonly saveProject: SaveProjectAction,
    private readonly canPersist: () => boolean,
    private readonly surfaceLabel: string,
    private readonly telemetry: Telemetry,
  ) {}

  async execute(options: PreprocessVideoOptions): Promise<void> {
    const { video, transcribePreference } = this.store.snapshot();
    const videoFile = video.file;
    if (!videoFile) return;

    this.store.patch({ status: 'preprocessing', error: null });
    await this.yieldOnePaint();

    const startedAt = performance.now();
    this.telemetry.capture('preprocessing_started', {
      surface: this.surfaceLabel,
      video_size_mb: this.videoSizeMb(videoFile),
    });

    const initialPersist = this.establishAndPersistInitial();

    try {
      const transcribed = await this.transcribe.execute(videoFile, transcribePreference, options.transcriber);
      this.store.patch({ document: transcribed });
      await this.runTaggers.execute();
      this.applyMultipleSpeakers.execute(options.multipleSpeakers);
      this.refresh.execute();
      await this.persistResult(initialPersist);
      this.telemetry.capture('preprocessing_completed', {
        surface: this.surfaceLabel,
        elapsed_ms: Math.round(performance.now() - startedAt),
      });
    } catch (err) {
      this.handleFailure(err, Math.round(performance.now() - startedAt));
    }
  }

  private videoSizeMb(videoFile: File): number {
    return Math.round((videoFile.size / (1024 * 1024)) * 10) / 10;
  }

  // Let the browser paint the splash before the heavy work starts.
  private async yieldOnePaint(): Promise<void> {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  /**
   * Stamps a fresh project identity (if needed) and kicks off the
   * first save in the background so it can run in parallel with the
   * transcription work. The returned promise is awaited by
   * `persistResult` later — failures surface there as a non-blocking
   * error rather than aborting the pipeline.
   *
   * No-op when persistence is forbidden.
   */
  private async establishAndPersistInitial(): Promise<void> {
    if (!this.canPersist()) return;
    if (this.store.snapshot().projectId === null) {
      await this.createProject.execute();
    }
    await this.saveProject.execute();
  }

  /**
   * Awaits the initial-save background promise, then writes the
   * project again so the transcribed and tagged document is persisted
   * in a single payload. A save failure here is surfaced as a
   * non-blocking error — the document itself stays in memory.
   */
  private async persistResult(initialPersist: Promise<void>): Promise<void> {
    if (!this.canPersist()) return;
    try {
      await initialPersist;
      await this.saveProject.execute();
    } catch (err) {
      console.error('[preprocess] auto-save after pipeline failed', err);
      this.store.patch({
        error: err instanceof Error ? err.message : 'Failed to save preprocessing result',
      });
    }
  }

  private handleFailure(err: unknown, elapsedMs: number): void {
    console.error('[preprocess] failed', err);
    this.store.patch({
      status: 'idle',
      error: err instanceof Error ? err.message : 'Preprocessing failed',
    });
    this.telemetry.capture('preprocessing_failed', {
      surface: this.surfaceLabel,
      elapsed_ms: elapsedMs,
      error_message: err instanceof Error ? err.message : 'unknown',
    });
  }
}
