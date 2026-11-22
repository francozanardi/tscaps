import { Document, Section, type TranscriberOptions } from '@tscaps/engine';
import type { SupportedLanguage } from '@shared/transcription-languages';
import type { EditorStore, EditorStatePatch } from '@core/editor/store/EditorStore';
import type { LanguageCanonicalCodeResolver } from '@core/preprocessing/services/LanguageCanonicalCodeResolver';
import { MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';
import type { TranscribePreference } from '@core/transcription/domain/TranscribePreference';
import type { UntranscribedRegionsStore } from '@core/transcription/store/UntranscribedRegionsStore';
import type { AssignCaptionModesAction } from '@core/caption-modes/actions/AssignCaptionModesAction';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { TranscribeAction } from '@core/transcription/actions/TranscribeAction';
import type { ReadSubtitleFileAction } from '@core/transcription/actions/ReadSubtitleFileAction';
import type { SubtitleFile } from '@core/transcription/domain/SubtitleFile';
import type { VideoRejectionResolver } from '@core/preprocessing/services/VideoRejectionResolver';
import type { RunTaggersAction } from '@core/tagging/actions/RunTaggersAction';
import type { ApplyMultipleSpeakersAction } from '@core/preprocessing/actions/ApplyMultipleSpeakersAction';
import type { ApplyTextDirectionAction } from '@core/preprocessing/actions/ApplyTextDirectionAction';
import type { VideoExportSupport } from '@core/export/domain/VideoExportSupport';
import { VideoExportUnsupportedError } from '@core/export/domain/VideoExportUnsupportedError';
import type { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import type { PreprocessingRunsStore } from '@core/preprocessing/store/PreprocessingRunsStore';
import type { ReleaseHandedOffVideoAction } from '@core/videos/actions/ReleaseHandedOffVideoAction';
import { PreprocessingPhaseTimeline } from '@core/preprocessing/services/PreprocessingPhaseTimeline';
import type { PreprocessPersistence } from '@core/preprocessing/services/PreprocessPersistence';
import type { PreprocessingTelemetryReporter } from '@core/preprocessing/services/PreprocessingTelemetryReporter';
import type { PreviewProxyRun, PreviewProxyStage } from '@core/preprocessing/services/PreviewProxyStage';
import { PreprocessingRun } from '@core/preprocessing/services/PreprocessingRun';
import type { AdmittedSource, SourceVideoAdmission } from '@core/preprocessing/services/SourceVideoAdmission';
import type { VideoMetadataProbe } from '@core/videos/domain/VideoMetadataProbe';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';
import { VideoDurationUnreadableError } from '@core/videos/domain/errors/VideoDurationUnreadableError';
import type { AppError } from '@core/errors/domain/AppError';
import type { AppErrorClassifier } from '@core/errors/services/AppErrorClassifier';
import type { StoragePersistence } from '@core/_shared/infrastructure/StoragePersistence';
import type { VisibilitySpan, VisibilityTracker } from '@core/_shared/domain/VisibilityTracker';

export interface PreprocessVideoOptions {
  readonly transcriber?: TranscriberOptions;
  readonly multipleSpeakers: boolean;
  readonly language?: SupportedLanguage;
  /** Captions to take from this file instead of transcribing the audio. */
  readonly subtitleFile?: SubtitleFile;
  /** Optional, timeline-aligned audio used only for transcription. */
  readonly transcriptionAudio?: File;
}

/**
 * Entry point for the editor's preprocessing pipeline over a freshly
 * loaded video: admits it (converting it first when this browser
 * cannot decode it and the reader accepts), transcribes it, resolves
 * the preview proxy, runs the semantic taggers, derives the visible
 * document, and persists the project. Sets `status` and `error` on the
 * editor store around the run and emits `preprocessing_*` telemetry
 * per phase.
 *
 * A converted video takes the chosen one's place in the editor store
 * before anything is persisted, so the project stores the conversion
 * and every later step reads it. It plays as it is, without a preview
 * proxy.
 *
 * A run belongs to the editor session it was started in. The reader
 * can open another video before it is over — the project's video can
 * keep uploading for a long time after the editor opened. Before the
 * source is admitted that ends the run, with nothing created or
 * charged. After it, the run writes nothing more to the editor and
 * finishes its session in a store of its own: the transcription it
 * paid for still reaches its project, with every pass the editor
 * would have run. Each run keeps its own progress, which the editor
 * shows while it shows the run's session. Every run is listed in the
 * runs store until it is over, and asking again for a video whose run
 * is still in flight does nothing.
 *
 * What a transcription left untranscribed is told to the reader only
 * while the editor shows the run's session, since the notice is about
 * the captions they are about to see there. A run that starts clears
 * the notice of the session before it.
 *
 * A run that fails after its project was started keeps the project,
 * unfinished, and is over only once the project is stored, its video
 * uploaded where projects keep their video on a server: its captions
 * can be started again from the stored video. Asking again for the
 * video of a run that failed starts a new run, even while the failed
 * one is still storing it.
 *
 * Asking the browser to keep this origin's storage is not gated on
 * whether the project may be saved: the run writes evictable data
 * either way.
 */
export class PreprocessVideoAction {
  constructor(
    private readonly store: EditorStore,
    private readonly transcribe: TranscribeAction,
    private readonly untranscribedRegions: UntranscribedRegionsStore,
    private readonly readSubtitleFile: ReadSubtitleFileAction,
    private readonly runTaggers: RunTaggersAction,
    private readonly applyMultipleSpeakers: ApplyMultipleSpeakersAction,
    private readonly applyTextDirection: ApplyTextDirectionAction,
    private readonly assignCaptionModes: AssignCaptionModesAction,
    private readonly refresh: RefreshDocumentAction,
    private readonly previewProxyStage: PreviewProxyStage,
    private readonly persistence: PreprocessPersistence,
    private readonly admission: SourceVideoAdmission,
    private readonly exportSupport: VideoExportSupport,
    private readonly videoRejectionResolver: VideoRejectionResolver,
    private readonly progressStore: PreprocessingProgressStore,
    private readonly telemetryReporter: PreprocessingTelemetryReporter,
    private readonly metadataProbe: VideoMetadataProbe,
    private readonly errorClassifier: AppErrorClassifier,
    private readonly storagePersistence: StoragePersistence,
    private readonly languageCanonicalCode: LanguageCanonicalCodeResolver,
    private readonly visibilityTracker: VisibilityTracker,
    private readonly runsStore: PreprocessingRunsStore,
    private readonly releaseHandedOffVideo: ReleaseHandedOffVideoAction,
  ) {}

  async execute(options: PreprocessVideoOptions): Promise<void> {
    const videoFile = this.store.snapshot().video.file;
    if (!videoFile || this.hasRunFor(videoFile)) return;
    const run = new PreprocessingRun(
      this.store,
      videoFile,
      this.progressStore,
      this.persistence.projectIdFor(this.store.snapshot()),
    );
    this.runsStore.add(run);
    try {
      await this.preprocess(run, options);
    } finally {
      run.close();
      this.runsStore.remove(run);
    }
  }

  private hasRunFor(videoFile: File): boolean {
    return this.runsStore.runs.some((run) => run.videoFile === videoFile && !run.hasFailed);
  }

  private async preprocess(run: PreprocessingRun, options: PreprocessVideoOptions): Promise<void> {
    const { video, transcribePreference } = this.store.snapshot();
    const videoFile = run.videoFile;

    const exportBlock = await this.rejectionIfExportUnsupported();
    if (exportBlock) {
      this.patchOwnEditor(run, { error: exportBlock });
      return;
    }

    const metadata = await this.probeSourceMetadata(videoFile);
    const durationSeconds = metadata?.durationSeconds ?? video.duration;
    const transcriptionLimit = Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds : video.duration;
    if (options.transcriptionAudio && !options.subtitleFile && (!Number.isFinite(transcriptionLimit) || transcriptionLimit <= 0)) {
      this.patchOwnEditor(run, { error: new VideoDurationUnreadableError({
        fileName: video.fileName, mimeType: video.mimeType, size: video.size,
      }) });
      return;
    }
    const rejection = await this.videoRejectionResolver.resolve(durationSeconds);
    if (rejection) {
      this.patchOwnEditor(run, { error: rejection });
      return;
    }
    if (!run.ownsEditor()) return;


    // Everything from here on writes something the browser is free to
    // throw away later: the transcription model, the preview proxy,
    // the project itself. Asking at this point ties the prompt that
    // some browsers show to an action the person just took, which a
    // request at page load could never do.
    void this.storagePersistence.ensure();

    this.store.patch({ status: 'preprocessing', error: null });
    this.untranscribedRegions.clear();
    await this.yieldOnePaint();
    if (!run.ownsEditor()) return;
    this.applyOriginalVideoLayout(metadata);
    const startedAt = performance.now();
    const timeline = new PreprocessingPhaseTimeline(run.progress);
    timeline.start();
    this.telemetryReporter.reportStarted(run, metadata);
    const visibility = this.visibilityTracker.begin();
    let openingPersist: Promise<void> | null = null;

    try {
      const source = await this.admission.admit(run, metadata);
      // The reader can open another video while this one is admitted,
      // an offer to convert it included. Nothing is created or charged
      // until the source is admitted, so the run ends here.
      if (!source || !run.ownsEditor()) return;
      if (source.converted) this.adoptConvertedSource(run, source.file);
      // Starts once the source is admitted: what it stores is the
      // admitted file, which a conversion only produces minutes later.
      openingPersist = this.persistence.begin(run);
      const transcribeInFlight = this.resolveTranscription(source.file, transcribePreference, options, metadata, transcriptionLimit, run);
      const proxyRun = await this.resolvePreview(run, source, transcribeInFlight);
      const transcribed = await transcribeInFlight;
      const editorReadyMs = await this.openEditor(run, transcribed, options, startedAt);
      const persisted = await this.persistence.finish(openingPersist, run);
      this.keepProxy(run, persisted, proxyRun);
      run.progress.markComplete();
      timeline.stop();
      this.telemetryReporter.reportCompleted(
        run,
        metadata,
        timeline,
        proxyRun,
        this.elapsedMsSince(startedAt),
        editorReadyMs,
      );
      await this.letGoOfHandoff(run, openingPersist);
    } catch (err) {
      timeline.stop();
      run.markFailed();
      this.handleFailure(err, run, metadata, timeline, visibility, this.elapsedMsSince(startedAt));
      // The project stays, unfinished. Until it is stored the run is not
      // over, so the projects page keeps showing it in progress.
      if (openingPersist) await this.persistence.settle(openingPersist);
    } finally {
      visibility.end();
    }
  }

  /**
   * Once the copy the run keeps is written, and the preview the run
   * publishes is out, moves the editor off a video a landing handed
   * over onto that copy. Earlier, the run itself still reads the file
   * it was given, and the preview it publishes at the end is that file.
   */
  private async letGoOfHandoff(run: PreprocessingRun, openingPersist: Promise<void>): Promise<void> {
    await this.persistence.settle(openingPersist);
    await this.releaseHandedOffVideo.execute(run.videoFile);
  }

  /**
   * Opens the run's session on the transcription. Resolves to how long
   * after `startedAt` the editor opened on it, or `null` when the reader
   * had moved on and the session was opened in the run's own store.
   */
  private async openEditor(
    run: PreprocessingRun,
    transcribed: Document,
    options: PreprocessVideoOptions,
    startedAt: number,
  ): Promise<number | null> {
    await this.openSession(run, transcribed, options);
    return run.ownsEditor() ? this.elapsedMsSince(startedAt) : null;
  }

  /**
   * Puts the transcription in the store that holds the run's session and
   * runs the passes that open it there. Tagging is the one pass that
   * waits, and a session that leaves the editor meanwhile is tagged
   * again in its own store: the editor kept nothing of it.
   */
  private async openSession(run: PreprocessingRun, transcribed: Document, options: PreprocessVideoOptions): Promise<void> {
    const tagged = run.store();
    await this.tagSession(tagged, transcribed);
    const store = run.store();
    if (store !== tagged) await this.tagSession(store, transcribed);
    this.applyMultipleSpeakers.execute(store, options.multipleSpeakers);
    this.applyTextDirection.execute(store);
    this.assignCaptionModes.execute(store);
    this.refresh.execute(store);
  }

  private async tagSession(store: EditorStore, transcribed: Document): Promise<void> {
    store.patch({ document: transcribed });
    await this.runTaggers.execute(store);
  }

  /**
   * Puts a conversion in place of the chosen video in the editor
   * store, so the project stores it and the transcription, the preview
   * and the export read it. The run takes the conversion as its own
   * file first, so its session carries on around it. The project keeps
   * the chosen video's name.
   */
  private adoptConvertedSource(run: PreprocessingRun, converted: File): void {
    run.adoptVideoFile(converted);
    const { video } = this.store.snapshot();
    if (video.url) URL.revokeObjectURL(video.url);
    this.store.patchVideo({
      file: converted,
      url: URL.createObjectURL(converted),
      fileName: converted.name,
      mimeType: converted.type,
      size: converted.size,
    });
  }

  /**
   * A conversion already wrote the source in a format every browser
   * plays, so it is published as the preview without encoding a proxy
   * from it.
   */
  private resolvePreview(
    run: PreprocessingRun,
    source: AdmittedSource,
    transcribeInFlight: Promise<Document>,
  ): Promise<PreviewProxyRun> {
    if (source.converted) return Promise.resolve(this.previewProxyStage.publishConvertedSource(run));
    return this.previewProxyStage.run(run, transcribeInFlight);
  }

  /** Stores a freshly encoded proxy under the run's project, once that project is durable. */
  private keepProxy(run: PreprocessingRun, persisted: boolean, proxyRun: PreviewProxyRun): void {
    if (!persisted || !proxyRun.proxy || run.projectId === null) return;
    this.previewProxyStage.storeInBackground(run.projectId, proxyRun.proxy);
  }

  /**
   * Reads the subtitle file the run was given, or starts the real
   * transcription, or resolves immediately with an empty document when
   * the source is known to carry no audio track and no separate audio
   * was chosen — there is no speech to transcribe, and the transcriber
   * would only fail trying to extract
   * audio. The rest of the pipeline runs as usual so the editor opens
   * and captions can be written by hand. A subtitle file is read even
   * then: it does not need the audio.
   */
  private resolveTranscription(
    videoFile: File,
    preference: TranscribePreference,
    { transcriber, language, subtitleFile, transcriptionAudio }: PreprocessVideoOptions,
    metadata: VideoSourceMetadata | null,
    durationSeconds: number,
    run: PreprocessingRun,
  ): Promise<Document> {
    const languageCode = language ? this.languageCanonicalCode.of(language) ?? null : null;
    if (subtitleFile) return this.readSubtitleFile.execute(subtitleFile, languageCode, run.progress);
    if (!transcriptionAudio && metadata?.hasAudioTrack === false) {
      return Promise.resolve(new Document({
        sections: [new Section({ segments: [], kind: MAIN_SHEET_ID })],
        language: languageCode,
      }));
    }
    return this.transcribeAudioSource(
      transcriptionAudio ?? videoFile, preference, run, transcriber, languageCode,
      transcriptionAudio ? durationSeconds : undefined,
    );
  }

  /**
   * Transcribes the selected audio source, and tells the reader what the
   * transcription left out while the editor shows the run's session.
   */
  private async transcribeAudioSource(
    audioSource: File,
    preference: TranscribePreference,
    run: PreprocessingRun,
    options: TranscriberOptions | undefined,
    languageCode: string | null,
    maxDurationSeconds?: number,
  ): Promise<Document> {
    const transcribed = await this.transcribe.execute(audioSource, preference, run, options, languageCode, maxDurationSeconds);
    const regions = transcribed.untranscribedRegions;
    if (regions.length > 0 && run.ownsEditor()) this.untranscribedRegions.publish(regions, preference.model);
    return transcribed.document;
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
    run: PreprocessingRun,
    metadata: VideoSourceMetadata | null,
    timeline: PreprocessingPhaseTimeline,
    visibility: VisibilitySpan,
    elapsedMs: number,
  ): void {
    console.error('[preprocess] failed', err);
    const appError = this.errorClassifier.wrap(err);
    this.patchOwnEditor(run, { status: 'idle', error: appError });
    this.telemetryReporter.reportFailed(run, metadata, timeline, appError, visibility, elapsedMs);
  }

  /** Writes to the editor only while it still shows this run's session. */
  private patchOwnEditor(run: PreprocessingRun, patch: EditorStatePatch): void {
    if (run.ownsEditor()) this.store.patch(patch);
  }

  private elapsedMsSince(startedAt: number): number {
    return Math.round(performance.now() - startedAt);
  }
}
