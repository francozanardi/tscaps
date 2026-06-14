import type { TranscriberOptions } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { TranscribeAction } from '@core/transcription/actions/TranscribeAction';
import type { RunTaggersAction } from '@core/tagging/actions/RunTaggersAction';
import type { ApplyMultipleSpeakersAction } from '@core/preprocessing/actions/ApplyMultipleSpeakersAction';
import type { CreateProjectAction } from '@core/projects/actions/CreateProjectAction';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import { ProjectSaveFailedError } from '@core/projects/domain/errors/ProjectSaveFailedError';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { TelemetryEventProperties } from '@core/telemetry/domain/TelemetryEventProperties';
import type { VideoMetadataProbe } from '@core/videos/domain/VideoMetadataProbe';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';
import type { AppError } from '@core/_shared/domain/AppError';
import type { AppErrorClassifier } from '@core/_shared/services/AppErrorClassifier';

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
    private readonly metadataProbe: VideoMetadataProbe,
    private readonly errorClassifier: AppErrorClassifier,
  ) {}

  async execute(options: PreprocessVideoOptions): Promise<void> {
    const { video, transcribePreference } = this.store.snapshot();
    const videoFile = video.file;
    if (!videoFile) return;

    this.store.patch({ status: 'preprocessing', error: null });
    await this.yieldOnePaint();

    const metadata = await this.probeSourceMetadata(videoFile);
    const startedAt = performance.now();
    this.telemetry.capture('preprocessing_started', {
      ...this.baseProperties(videoFile),
      ...this.metadataProperties(metadata),
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
        ...this.baseProperties(videoFile),
        ...this.metadataProperties(metadata),
        elapsed_ms: Math.round(performance.now() - startedAt),
      });
    } catch (err) {
      this.handleFailure(err, videoFile, metadata, Math.round(performance.now() - startedAt));
    }
  }

  private baseProperties(videoFile: File): TelemetryEventProperties {
    return {
      surface: this.surfaceLabel,
      video_size_mb: this.videoSizeMb(videoFile),
    };
  }

  private videoSizeMb(videoFile: File): number {
    return Math.round((videoFile.size / (1024 * 1024)) * 10) / 10;
  }

  // Let the browser paint the splash before the heavy work starts.
  private async yieldOnePaint(): Promise<void> {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  /**
   * Reads container-level facts from the source so each telemetry
   * event carries the codec / sample-rate / channel context that
   * matters for diagnosing pipeline failures. A probe failure is
   * swallowed and reported as `null` metadata so it never blocks
   * the actual run.
   */
  private async probeSourceMetadata(videoFile: File): Promise<VideoSourceMetadata | null> {
    try {
      return await this.metadataProbe.probe(videoFile);
    } catch (err) {
      console.warn('[preprocess] metadata probe failed', err);
      return null;
    }
  }

  private metadataProperties(metadata: VideoSourceMetadata | null): TelemetryEventProperties {
    if (!metadata) return {};
    return {
      mime_type: metadata.mimeType,
      container_format: metadata.containerFormat,
      duration_s: metadata.durationSeconds,
      video_codec: metadata.videoCodec,
      audio_codec: metadata.audioCodec,
      audio_sample_rate: metadata.audioSampleRate,
      audio_channels: metadata.audioChannels,
    };
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
    } catch (cause) {
      console.error('[preprocess] auto-save after pipeline failed', cause);
      this.store.patch({ error: new ProjectSaveFailedError({ cause }) });
    }
  }

  private handleFailure(
    err: unknown,
    videoFile: File,
    metadata: VideoSourceMetadata | null,
    elapsedMs: number,
  ): void {
    console.error('[preprocess] failed', err);
    const appError = this.errorClassifier.wrap(err);
    this.store.patch({ status: 'idle', error: appError });
    this.telemetry.capture('preprocessing_failed', {
      ...this.baseProperties(videoFile),
      ...this.metadataProperties(metadata),
      ...this.errorProperties(appError),
      elapsed_ms: elapsedMs,
    });
  }

  private errorProperties(appError: AppError): TelemetryEventProperties {
    const cause = appError.cause instanceof Error ? appError.cause : null;
    return {
      error_name: appError.name,
      error_message: appError.message,
      error_cause_name: cause ? cause.name : null,
      error_cause_message: cause ? cause.message : null,
    };
  }
}
