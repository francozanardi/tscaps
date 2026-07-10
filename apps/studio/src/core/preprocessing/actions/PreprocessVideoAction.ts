import type { Document, TranscriberOptions } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { TranscribeAction } from '@core/transcription/actions/TranscribeAction';
import type { RunTaggersAction } from '@core/tagging/actions/RunTaggersAction';
import type { ApplyHookSheetAction } from '@core/preprocessing/actions/ApplyHookSheetAction';
import type { ApplyMultipleSpeakersAction } from '@core/preprocessing/actions/ApplyMultipleSpeakersAction';
import type { CreateProjectAction } from '@core/projects/actions/CreateProjectAction';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import { ProjectSaveFailedError } from '@core/projects/domain/errors/ProjectSaveFailedError';
import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type { PreviewProxyProgressCallback } from '@core/preview/domain/PreviewProxyGenerator';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';
import type { PreviewProxyResolver } from '@core/preview/services/PreviewProxyResolver';
import type { VideoCompatibilityChecker } from '@core/videos/domain/VideoCompatibilityChecker';
import type { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import type { ProxyTiming } from '@core/preprocessing/domain/ProxyTiming';
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
 * Entry point for the editor's preprocessing pipeline over a freshly
 * loaded video: transcribes it, resolves the preview proxy, runs the
 * semantic taggers, derives the visible document, and persists the
 * project. Sets `status` and `error` on the editor store around the
 * run and emits `preprocessing_*` telemetry per phase.
 *
 * Persistence is gated by the supplied `canPersist` callback.
 */
export class PreprocessVideoAction {
  constructor(
    private readonly store: EditorStore,
    private readonly transcribe: TranscribeAction,
    private readonly runTaggers: RunTaggersAction,
    private readonly applyHookSheet: ApplyHookSheetAction,
    private readonly applyMultipleSpeakers: ApplyMultipleSpeakersAction,
    private readonly refresh: RefreshDocumentAction,
    private readonly createProject: CreateProjectAction,
    private readonly saveProject: SaveProjectAction,
    private readonly previewProxyResolver: PreviewProxyResolver,
    private readonly proxyRepository: PreviewProxyRepository,
    private readonly compatibilityChecker: VideoCompatibilityChecker,
    private readonly progressStore: PreprocessingProgressStore,
    private readonly proxyTiming: ProxyTiming,
    private readonly previewProxyEnabled: boolean,
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
    this.applyOriginalVideoLayout(metadata);
    const startedAt = performance.now();
    this.telemetry.capture('preprocessing_started', {
      ...this.baseProperties(videoFile),
      ...this.metadataProperties(metadata),
    });

    const initialPersist = this.establishAndPersistInitial();

    try {
      await this.compatibilityChecker.check(videoFile);
      const transcribeInFlight = this.transcribe.execute(
        videoFile,
        transcribePreference,
        options.transcriber,
      );
      const freshProxy = await this.runPreviewProxy(videoFile, transcribeInFlight);
      const transcribed = await transcribeInFlight;
      this.store.patch({ document: transcribed });
      await this.runTaggers.execute();
      this.applyHookSheet.execute();
      this.applyMultipleSpeakers.execute(options.multipleSpeakers);
      this.refresh.execute();
      const persisted = await this.persistResult(initialPersist);
      if (persisted && freshProxy) this.dispatchProxyStore(freshProxy);
      this.progressStore.markComplete();
      this.telemetry.capture('preprocessing_completed', {
        ...this.baseProperties(videoFile),
        ...this.metadataProperties(metadata),
        elapsed_ms: Math.round(performance.now() - startedAt),
      });
    } catch (err) {
      this.handleFailure(err, videoFile, metadata, Math.round(performance.now() - startedAt));
    }
  }

  /**
   * Publishes the preview proxy in step with the transcribe run.
   * Returns the freshly generated proxy so the caller may persist it
   * once the project row is durable, or `null` when a cached proxy
   * was reused or the pipeline is disabled.
   *
   * Timing is tuned to the active surface via `proxyTiming`:
   *
   * - `parallel-with-transcribe`: starts encoding once the transcriber
   *   leaves its audio-extract phase, so proxy I/O over the source
   *   does not compete with audio extraction. Encoding then runs
   *   alongside the transcribe HTTP roundtrip.
   * - `sequential-after-transcribe`: waits for transcribe to finish
   *   before encoding — used when transcribe runs a browser-side
   *   worker that would compete with the encoder for the CPU.
   */
  private async runPreviewProxy(
    source: Blob,
    transcribeInFlight: Promise<Document>,
  ): Promise<PreviewProxy | null> {
    if (!this.previewProxyEnabled) {
      this.publishPreviewFile(source);
      return null;
    }
    const reportProgress = (progress: number) => this.progressStore.setPreviewProxyProgress(progress);
    const generation = this.encodePreviewProxyAtScheduledMoment(source, transcribeInFlight, reportProgress);
    await this.settleTranscribe(transcribeInFlight);
    this.progressStore.enterPreviewProxyPhase();
    return generation;
  }

  private async encodePreviewProxyAtScheduledMoment(
    source: Blob,
    transcribeInFlight: Promise<Document>,
    reportProgress: PreviewProxyProgressCallback,
  ): Promise<PreviewProxy | null> {
    await this.waitForProxyStartMoment(transcribeInFlight);
    return this.resolveAndPublishPreviewProxy(source, reportProgress);
  }

  private waitForProxyStartMoment(transcribeInFlight: Promise<Document>): Promise<void> {
    if (this.proxyTiming === 'parallel-with-transcribe') {
      return this.waitForAudioExtractToFinish(transcribeInFlight);
    }
    return this.settleTranscribe(transcribeInFlight);
  }

  private async resolveAndPublishPreviewProxy(
    source: Blob,
    onProgress: PreviewProxyProgressCallback,
  ): Promise<PreviewProxy | null> {
    const resolution = await this.previewProxyResolver.fromSource(source, onProgress);
    this.publishPreviewFile(resolution.previewBlob);
    return resolution.freshProxy;
  }

  private publishPreviewFile(blob: Blob): void {
    this.store.patchVideo({ previewFile: blob });
  }

  /**
   * Resolves once the progress store reports the audio-extract phase
   * is past — covers transcribers that emit a later phase (e.g. one
   * that moves into `inferring`) and transcribers that never went
   * through audio-extract at all. Also resolves when the transcribe
   * promise settles for any other reason, so a failure before the
   * phase advances does not leave the pipeline waiting forever.
   */
  private waitForAudioExtractToFinish(transcribeInFlight: Promise<Document>): Promise<void> {
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.progressStore.removeEventListener('change', onPhaseChange);
        resolve();
      };
      const onPhaseChange = () => {
        if (this.progressStore.isPhasePast('audio-extract')) finish();
      };
      this.progressStore.addEventListener('change', onPhaseChange);
      onPhaseChange();
      void transcribeInFlight.then(finish, finish);
    });
  }

  private settleTranscribe(transcribeInFlight: Promise<Document>): Promise<void> {
    return transcribeInFlight.then(
      () => undefined,
      () => undefined,
    );
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

  private async probeSourceMetadata(videoFile: File): Promise<VideoSourceMetadata | null> {
    try {
      return await this.metadataProbe.probe(videoFile);
    } catch (err) {
      console.warn('[preprocess] metadata probe failed', err);
      return null;
    }
  }

  /**
   * Stamps `video.layout` with the source's true pixel dimensions.
   * The preview surface later loads a downscaled proxy whose
   * intrinsic size would otherwise overwrite this field and steer
   * export at the proxy resolution instead of the source's.
   */
  private applyOriginalVideoLayout(metadata: VideoSourceMetadata | null): void {
    if (!metadata) return;
    if (metadata.videoWidthPx === null || metadata.videoHeightPx === null) return;
    this.store.setVideoLayout({ width: metadata.videoWidthPx, height: metadata.videoHeightPx });
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
   * transcription work. Awaited by `persistResult` later. No-op when
   * persistence is forbidden.
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
   * project again so the transcribed and tagged document lands in a
   * single payload. Resolves to `true` when the project row is
   * durable, `false` when persistence was skipped or either save
   * failed. A save failure is surfaced as a non-blocking error.
   */
  private async persistResult(initialPersist: Promise<void>): Promise<boolean> {
    if (!this.canPersist()) return false;
    try {
      await initialPersist;
      await this.saveProject.execute();
      return true;
    } catch (cause) {
      console.error('[preprocess] auto-save after pipeline failed', cause);
      this.store.patch({ error: new ProjectSaveFailedError({ cause }) });
      return false;
    }
  }

  /**
   * Fires the proxy persistence in the background. The editor is
   * already playing the freshly generated proxy locally; a failure
   * to durably store it only impacts the next open of this project.
   */
  private dispatchProxyStore(proxy: PreviewProxy): void {
    const projectId = this.store.snapshot().projectId;
    if (projectId === null) return;
    void this.proxyRepository.store(projectId, proxy).catch((error) => {
      console.error('[preprocess] preview-proxy store failed', error);
    });
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
