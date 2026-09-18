import { Document, Section, type TranscriberOptions } from '@tscaps/engine';
import type { SupportedLanguage } from '@shared/transcription-languages';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { LanguageCanonicalCodeResolver } from '@core/preprocessing/services/LanguageCanonicalCodeResolver';
import { MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';
import type { TranscribePreference } from '@core/transcription/domain/TranscribePreference';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { TranscribeAction } from '@core/transcription/actions/TranscribeAction';
import type { TranscriptionAudioLengthPolicy } from '@core/transcription/domain/TranscriptionAudioLengthPolicy';
import type { RunTaggersAction } from '@core/tagging/actions/RunTaggersAction';
import type { ApplyMultipleSpeakersAction } from '@core/preprocessing/actions/ApplyMultipleSpeakersAction';
import type { ApplyTextDirectionAction } from '@core/preprocessing/actions/ApplyTextDirectionAction';
import type { VideoCompatibilityChecker } from '@core/videos/domain/VideoCompatibilityChecker';
import type { VideoExportSupport } from '@core/export/domain/VideoExportSupport';
import { VideoExportUnsupportedError } from '@core/export/domain/VideoExportUnsupportedError';
import type { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import { PreprocessingPhaseTimeline } from '@core/preprocessing/services/PreprocessingPhaseTimeline';
import type { PreprocessPersistence } from '@core/preprocessing/services/PreprocessPersistence';
import type { PreprocessingTelemetryReporter } from '@core/preprocessing/services/PreprocessingTelemetryReporter';
import type { PreviewProxyStage } from '@core/preprocessing/services/PreviewProxyStage';
import type { VideoMetadataProbe } from '@core/videos/domain/VideoMetadataProbe';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';
import type { AppError } from '@core/errors/domain/AppError';
import type { AppErrorClassifier } from '@core/errors/services/AppErrorClassifier';
import type { StoragePersistence } from '@core/_shared/infrastructure/StoragePersistence';

export interface PreprocessVideoOptions {
  readonly transcriber?: TranscriberOptions;
  readonly multipleSpeakers: boolean;
  readonly language?: SupportedLanguage;
}

/**
 * Entry point for the editor's preprocessing pipeline over a freshly
 * loaded video: transcribes it, resolves the preview proxy, runs the
 * semantic taggers, derives the visible document, and persists the
 * project. Sets `status` and `error` on the editor store around the
 * run and emits `preprocessing_*` telemetry per phase.
 *
 * Asking the browser to keep this origin's storage is not gated on
 * whether the project may be saved: the run writes evictable data
 * either way.
 */
export class PreprocessVideoAction {
  constructor(
    private readonly store: EditorStore,
    private readonly transcribe: TranscribeAction,
    private readonly runTaggers: RunTaggersAction,
    private readonly applyMultipleSpeakers: ApplyMultipleSpeakersAction,
    private readonly applyTextDirection: ApplyTextDirectionAction,
    private readonly refresh: RefreshDocumentAction,
    private readonly previewProxyStage: PreviewProxyStage,
    private readonly persistence: PreprocessPersistence,
    private readonly compatibilityChecker: VideoCompatibilityChecker,
    private readonly exportSupport: VideoExportSupport,
    private readonly audioLengthPolicy: TranscriptionAudioLengthPolicy,
    private readonly progressStore: PreprocessingProgressStore,
    private readonly telemetryReporter: PreprocessingTelemetryReporter,
    private readonly metadataProbe: VideoMetadataProbe,
    private readonly errorClassifier: AppErrorClassifier,
    private readonly storagePersistence: StoragePersistence,
    private readonly languageCanonicalCode: LanguageCanonicalCodeResolver,
  ) {}

  async execute(options: PreprocessVideoOptions): Promise<void> {
    const { video, transcribePreference } = this.store.snapshot();
    const videoFile = video.file;
    if (!videoFile) return;

    const exportBlock = await this.rejectionIfExportUnsupported();
    if (exportBlock) {
      this.store.patch({ error: exportBlock });
      return;
    }

    const metadata = await this.probeSourceMetadata(videoFile);
    const capCheckError = this.rejectionIfOverCap(metadata?.durationSeconds ?? video.duration);
    if (capCheckError) {
      this.store.patch({ error: capCheckError });
      return;
    }


    // Everything from here on writes something the browser is free to
    // throw away later: the transcription model, the preview proxy,
    // the project itself. Asking at this point ties the prompt that
    // some browsers show to an action the person just took, which a
    // request at page load could never do.
    void this.storagePersistence.ensure();

    this.store.patch({ status: 'preprocessing', error: null });
    await this.yieldOnePaint();
    this.applyOriginalVideoLayout(metadata);
    const startedAt = performance.now();
    const timeline = new PreprocessingPhaseTimeline(this.progressStore);
    timeline.start();
    this.telemetryReporter.reportStarted(videoFile, metadata);

    const openingPersist = this.persistence.begin();

    try {
      await this.compatibilityChecker.check(videoFile);
      const transcribeInFlight = this.resolveTranscription(
        videoFile,
        transcribePreference,
        options.transcriber,
        metadata,
        options.language,
      );
      const proxyRun = await this.previewProxyStage.run(videoFile, transcribeInFlight);
      const transcribed = await transcribeInFlight;
      this.store.patch({ document: transcribed });
      await this.applyDocumentPasses(options);
      const persisted = await this.persistence.finish(openingPersist);
      if (persisted && proxyRun.proxy) this.previewProxyStage.storeInBackground(proxyRun.proxy);
      this.progressStore.markComplete();
      timeline.stop();
      this.telemetryReporter.reportCompleted(
        videoFile,
        metadata,
        timeline,
        proxyRun,
        this.elapsedMsSince(startedAt),
      );
    } catch (err) {
      timeline.stop();
      this.handleFailure(err, videoFile, metadata, timeline, this.elapsedMsSince(startedAt));
    }
  }

  private async applyDocumentPasses(options: PreprocessVideoOptions): Promise<void> {
    await this.runTaggers.execute();
    this.applyMultipleSpeakers.execute(options.multipleSpeakers);
    this.applyTextDirection.execute();
    this.refresh.execute();
  }

  /**
   * Starts the real transcription, or resolves immediately with an
   * empty document when the source is known to carry no audio track —
   * there is no speech to transcribe, and the transcriber would only
   * fail trying to extract audio. The rest of the pipeline runs as
   * usual so the editor opens and captions can be written by hand.
   */
  private resolveTranscription(
    videoFile: File,
    preference: TranscribePreference,
    transcriber: TranscriberOptions | undefined,
    metadata: VideoSourceMetadata | null,
    language: SupportedLanguage | undefined,
  ): Promise<Document> {
    const languageCode = language ? this.languageCanonicalCode.of(language) ?? null : null;
    if (metadata?.hasAudioTrack === false) {
      return Promise.resolve(new Document({
        sections: [new Section({ segments: [], kind: MAIN_SHEET_ID })],
        language: languageCode,
      }));
    }
    return this.transcribe.execute(videoFile, preference, transcriber, languageCode);
  }

  /**
   * A browser that can encode no video at all will not export this
   * file or any other, so it is worth saying before a second is spent
   * transcribing one. Checked ahead of the source's own compatibility
   * because it is the cheaper question and the more final answer.
   */
  private async rejectionIfExportUnsupported(): Promise<AppError | null> {
    if (await this.exportSupport.isSupported()) return null;
    return new VideoExportUnsupportedError();
  }

  /**
   * Runs the cap check on the freshly probed duration before any side
   * effect and returns the wrapped rejection when the video is over
   * the cap, or `null` when it fits. Called first inside `execute` so
   * a rejected attempt never patches `status`, never emits telemetry,
   * and never opens an HTTP round-trip to the project backend.
   */
  private rejectionIfOverCap(durationSeconds: number): AppError | null {
    try {
      this.audioLengthPolicy.enforce(durationSeconds);
      return null;
    } catch (err) {
      return this.errorClassifier.wrap(err);
    }
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

  private handleFailure(
    err: unknown,
    videoFile: File,
    metadata: VideoSourceMetadata | null,
    timeline: PreprocessingPhaseTimeline,
    elapsedMs: number,
  ): void {
    console.error('[preprocess] failed', err);
    const appError = this.errorClassifier.wrap(err);
    this.store.patch({ status: 'idle', error: appError });
    this.telemetryReporter.reportFailed(videoFile, metadata, timeline, appError, elapsedMs);
  }

  private elapsedMsSince(startedAt: number): number {
    return Math.round(performance.now() - startedAt);
  }
}
