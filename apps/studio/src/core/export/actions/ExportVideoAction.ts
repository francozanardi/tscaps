import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type {
  VideoRenderer,
  OutputFormat,
  RenderQuality,
  RenderBackground,
  AudioDiscardReason,
  AudioMixDropReason,
  VideoFrameDecoderSelection,
  VideoEncoderSelection,
} from '@tscaps/engine';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { AudioMixEncodeSupport } from '@core/export/domain/AudioMixEncodeSupport';
import type { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { FileDownloader } from '@core/_shared/domain/FileDownloader';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ExportPauseCoordinator } from '@core/export/services/ExportPauseCoordinator';
import type { ExportCancelCoordinator } from '@core/export/services/ExportCancelCoordinator';
import type { ExportWriter } from '@core/export/domain/ExportWriter';
import type { ExportWriterFactory } from '@core/export/domain/ExportWriterFactory';
import type { ExportProgressStore } from '@core/export/store/ExportProgressStore';
import type { ExportStore } from '@core/export/store/ExportStore';
import type { ExportRunPhase } from '@core/export/domain/ExportRun';
import type { ExportNotice } from '@core/export/domain/ExportNotice';
import type { ExportRenderPlan, ExportRenderPlanner } from '@core/export/services/ExportRenderPlanner';
import type { ExportRenderPlanRequestBuilder } from '@core/export/services/ExportRenderPlanRequestBuilder';
import type { ExportRenderJobBuilder } from '@core/export/services/ExportRenderJobBuilder';
import type { OriginalVideoResolver } from '@core/videos/services/OriginalVideoResolver';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import type { ExportAudioMixOutcome, ExportRunTelemetry, ExportUnavailableFilesKind } from '@core/export/services/ExportRunTelemetry';
import type { VisibilitySpan, VisibilityTracker } from '@core/_shared/domain/VisibilityTracker';
import type { ExportAccessPolicy } from '@core/export/domain/ExportAccessPolicy';
import type { VideoBlobSource } from '@core/videos/domain/VideoBlobLookup';
import { OriginalVideoUnavailableError } from '@core/videos/domain/errors/OriginalVideoUnavailableError';

/**
 * Target output dimensions chosen by the user. `'original'` means
 * "keep the source resolution"; an explicit `{ width, height }` value
 * triggers a downscale in the renderer (it never upscales beyond the
 * source).
 */
export type ExportResolution = 'original' | { width: number; height: number };

export interface ExportVideoOptions {
  format: OutputFormat;
  quality: RenderQuality;
  resolution: ExportResolution;
  /** What the captions are painted on; absent means the video. Transparent needs WebM. */
  background?: RenderBackground;
  /**
   * Absent means `'keep'`: the video's audio goes into the file at the
   * soundtrack's level for it, mixed with the soundtrack's clips.
   * `'discard'` leaves out both.
   */
  audio?: 'keep' | 'discard';
}

/** The soundtrack a run is meant to carry, as settled before it starts. */
interface PlannedSoundtrack {
  /** What the render mixes: the project's, or the empty mix when it cannot be written here. */
  readonly mix: AudioMix;
  /** Whether the project's soundtrack adds sounds (clips, a layer's own sound), rather than only changing the video's own. */
  readonly hasSounds: boolean;
  /** The codec it is to be written with; null when none can be. */
  readonly codec: string | null;
  /** Why it is left out before the run, or null when it goes in. */
  readonly droppedReason: AudioMixDropReason | null;
}

/**
 * Runs one export from the editor: plans what to burn, opens a writer,
 * drives the renderer into it, hands the finished file to the user, and
 * reports the outcome.
 *
 * What gets burned is the planner's answer — this action owns the run,
 * not the picture. Named *VideoAction* to disambiguate from
 * `ExportProjectAction` (which exports the project metadata as a
 * `.tscaps` file).
 *
 * `videoIsUploaded` says whether this session's projects keep their
 * video on a server, which decides what an export with no readable
 * original can offer: a reload, or the file chosen once more.
 *
 * The project's soundtrack goes wherever the video's own sound goes. A
 * soundtrack no codec can be written with here is left out before the
 * run, which the export dialog has already said; the video's own sound
 * is then written as it would be without one. The video's own sound
 * turned all the way down is left out of the file rather than mixed to
 * silence; any other level than its own, overall or in a shot, is
 * mixed, sounds added or not.
 */
export class ExportVideoAction {

  constructor(
    private readonly editorStore: EditorStore,
    private readonly exportStore: ExportStore,
    private readonly originalVideoResolver: OriginalVideoResolver,
    private readonly renderer: VideoRenderer,
    private readonly planner: ExportRenderPlanner,
    private readonly exportPauseCoordinator: ExportPauseCoordinator,
    private readonly exportCancelCoordinator: ExportCancelCoordinator,
    private readonly exportWriterFactory: ExportWriterFactory,
    private readonly fileDownloader: FileDownloader,
    private readonly progressStore: ExportProgressStore,
    private readonly saveProject: SaveProjectAction,
    private readonly runTelemetry: ExportRunTelemetry,
    private readonly saveFailureReporter: NonBlockingFailureReporter,
    private readonly visibilityTracker: VisibilityTracker,
    private readonly accessPolicy: ExportAccessPolicy,
    private readonly videoIsUploaded: boolean,
    private readonly mediaAssets: MediaAssetStore,
    private readonly originalCaptions: OriginalCaptionTrackReader,
    private readonly audioMixEncodeSupport: AudioMixEncodeSupport,
    private readonly planRequests: ExportRenderPlanRequestBuilder,
    private readonly jobs: ExportRenderJobBuilder,
  ) {}

  async execute(options: ExportVideoOptions): Promise<void> {
    const state = this.editorStore.snapshot();
    if (!this.accessPolicy.access(state).available) return;
    const { video, document, sheets, shots } = state;
    if (!document || sheets.length === 0 || video.fileName === null) return;

    // Open the writer before the heavy work: if the user cancels an
    // interactive prompt we abort without spending any encoding time.
    const writer = await this.openWriter(options.format);
    if (!writer) return;
    const soundtrack = await this.planSoundtrack(options, state.audio);
    const inputAudio = this.inputAudioOf(options, state.audio);

    // The phase follows what can be read, not what the store holds: a
    // picked file whose bytes have gone away leaves the run waiting on
    // storage like a project whose original is still in flight.
    const fileInEditor = await this.originalVideoResolver.readableFileInEditor();
    const originalPhase: ExportRunPhase = fileInEditor !== null ? 'rendering' : 'awaiting-original';

    this.progressStore.reset();
    // Planning waits for the files the shots show and the sounds the mix plays, which may still be coming down.
    this.exportStore.start(this.waitsForFiles(shots, soundtrack) ? 'awaiting-footage' : originalPhase);
    this.editorStore.patch({ error: null });

    void this.persistAlongsideRender();

    await this.runRender(options, inputAudio, writer, sheets, fileInEditor, originalPhase, soundtrack);
  }

  /**
   * The soundtrack this run carries, or null when it is meant to carry
   * none: the project has no clip and leaves the video's own sound at
   * its level or all the way down, or the export leaves the sound out.
   *
   * A level alone that no codec can write is not worth saying anything
   * about: the video's own sound goes in at its own level, as it would
   * without a soundtrack.
   */
  private async planSoundtrack(options: ExportVideoOptions, audio: AudioMix): Promise<PlannedSoundtrack | null> {
    if (options.audio === 'discard' || !this.isMixed(audio)) return null;
    const hasSounds = audio.hasSounds();
    const codec = await this.audioMixEncodeSupport.codecFor(options.format);
    if (codec === null) {
      return hasSounds ? { mix: AudioMix.empty(), hasSounds, codec, droppedReason: 'no-encodable-target-codec' } : null;
    }
    return { mix: audio, hasSounds, codec, droppedReason: null };
  }

  /**
   * Whether `audio` asks for a mix: sounds to add, or the video's own
   * sound above silence and off its own level, all along or in a shot.
   */
  private isMixed(audio: AudioMix): boolean {
    return audio.hasSounds() || (audio.sourceVolume > 0 && (audio.sourceVolume !== 1 || audio.hasShotVideoVolumes()));
  }

  /** What becomes of the video's own sound: left out when the export or the soundtrack turns it off. */
  private inputAudioOf(options: ExportVideoOptions, audio: AudioMix): 'keep' | 'discard' | undefined {
    return audio.sourceVolume === 0 ? 'discard' : options.audio;
  }

  /**
   * Whether planning waits on files. Asked of the shots and the planned
   * soundtrack rather than the project's media in use: a soundtrack the
   * run leaves out waits for nothing, and a bundled sound is not a
   * media file but is still read.
   */
  private waitsForFiles(shots: ShotPartition, soundtrack: PlannedSoundtrack | null): boolean {
    return shots.mediaIdsInUse().size > 0 || (soundtrack?.mix.hasSounds() ?? false);
  }

  private plan(signal: AbortSignal, soundtrack: PlannedSoundtrack | null): Promise<ExportRenderPlan> {
    const state = this.editorStore.snapshot();
    const original = this.originalCaptions.read(state);
    return this.planner.plan(this.planRequests.build(state, {
      originalDocument: original.document,
      originalSheets: original.sheets,
      originalDecorationOverrides: original.decorationOverrides,
      media: this.mediaAssets.snapshot(),
      audio: soundtrack?.mix ?? AudioMix.empty(),
      signal,
    }));
  }

  private async runRender(
    options: ExportVideoOptions,
    inputAudio: 'keep' | 'discard' | undefined,
    writer: ExportWriter,
    sheets: readonly Sheet[],
    fileInEditor: File | null,
    originalPhase: ExportRunPhase,
    soundtrack: PlannedSoundtrack | null,
  ): Promise<void> {
    let audioDiscardedReason: AudioDiscardReason | null = null;
    let audioMixDroppedReason: AudioMixDropReason | null = soundtrack?.droppedReason ?? null;
    let audioMixInputFallbackError: string | null = null;
    let decoderSelection: VideoFrameDecoderSelection | null = null;
    let encoderSelection: VideoEncoderSelection | null = null;
    let videoSource: VideoBlobSource | null = null;
    console.time('[export] total');
    const startedAt = performance.now();
    const visibilitySpan = this.visibilityTracker.begin();
    const signal = this.exportCancelCoordinator.begin();
    this.runTelemetry.started(options, sheets);
    try {
      const plan = await this.plan(signal, soundtrack);
      // A run abandoned while its footage came down ends here, before it
      // asks anything about footage that could not be had.
      signal.throwIfAborted();
      this.exportStore.enterPhase(originalPhase);
      await this.confirmGoingWithoutFootage(plan);
      await this.confirmGoingWithoutSounds(plan);
      const resolved = await this.resolveOriginalVideo(fileInEditor);
      videoSource = resolved.source;
      const videoFile = resolved.file;
      // A run abandoned while it waited on the original stops here,
      // before the renderer opens anything.
      signal.throwIfAborted();
      await this.renderer.render(
        {
          video: videoFile,
          ...this.jobs.pictureOf(plan),
          ...(plan.audioMix === null ? {} : { audioMix: plan.audioMix }),
          outputFormat: options.format,
          quality: options.quality,
          ...(options.background ? { background: options.background } : {}),
          ...(inputAudio ? { audio: inputAudio } : {}),
          ...(options.resolution !== 'original' ? { outputResolution: options.resolution } : {}),
          outputStream: writer.stream(),
          signal,
          confirmFallbackDecoder: (info) => this.exportPauseCoordinator.pauseAndAwait({
            kind: 'fallback-decoder',
            codec: info.inputCodec,
          }),
          confirmUndecodableAudioLayers: (layerIds) => this.confirmGoingWithoutUndecodableSounds(plan, layerIds),
          onAudioDiscarded: (reason) => { audioDiscardedReason = reason; },
          onAudioMixDropped: (reason) => { audioMixDroppedReason = reason; },
          onAudioMixInputFallback: (cause) => { audioMixInputFallbackError = this.describeError(cause); },
          onVideoFrameDecoderSelected: (selection) => { decoderSelection = selection; },
          onVideoEncoderSelected: (selection) => { encoderSelection = selection; },
        },
        (p) => this.updateProgress(p.percent),
      );

      const file = await writer.finalize();
      if (file) this.triggerDownload(file, options.format);

      this.exportStore.finish(this.noticeFor(options.format, audioDiscardedReason, audioMixDroppedReason, soundtrack));
      this.runTelemetry.completed({
        options,
        elapsedMs: Math.round(performance.now() - startedAt),
        sheets,
        audioDiscardedReason,
        audioMix: this.audioMixOutcome(soundtrack, plan, audioMixDroppedReason, audioMixInputFallbackError),
        decoderSelection,
        encoderSelection,
        videoSource,
      });
    } catch (err) {
      await writer.abort();
      const elapsedMs = Math.round(performance.now() - startedAt);
      if (this.isCancellation(err)) {
        this.reportCancellation(options, elapsedMs);
      } else {
        this.reportFailure(err, options, elapsedMs, visibilitySpan, decoderSelection, encoderSelection, videoSource);
      }
    } finally {
      this.exportCancelCoordinator.end();
      visibilitySpan.end();
      console.timeEnd('[export] total');
      writer.dispose();
    }
  }

  /**
   * Asks before burning without files meant to show over the video.
   * Declining ends the run the way a cancelled one ends.
   */
  private async confirmGoingWithoutFootage(plan: ExportRenderPlan): Promise<void> {
    if (plan.unavailableFootage.length === 0) return;
    const accepted = await this.exportPauseCoordinator.pauseAndAwait({
      kind: 'footage-unavailable',
      fileNames: plan.unavailableFootage,
    });
    this.answerUnavailableFiles('footage', plan.unavailableFootage.length, accepted);
    if (!accepted) throw new DOMException('The export was declined without its footage.', 'AbortError');
  }

  /**
   * Asks before mixing without sound files the soundtrack plays.
   * Declining ends the run the way a cancelled one ends.
   */
  /**
   * A sound that passed the import check but cannot be decoded whole
   * asks the question a missing file does. A layer the plan leaves
   * unnamed, a b-roll's own sound, goes unasked.
   */
  private async confirmGoingWithoutUndecodableSounds(plan: ExportRenderPlan, layerIds: ReadonlyArray<string>): Promise<boolean> {
    const fileNames = layerIds.flatMap((layerId) => {
      const name = plan.audioLayerFileNames.get(layerId);
      return name === undefined ? [] : [name];
    });
    if (fileNames.length === 0) return true;
    const distinctFileNames = [...new Set(fileNames)];
    const accepted = await this.exportPauseCoordinator.pauseAndAwait({ kind: 'audio-unavailable', fileNames: distinctFileNames });
    this.answerUnavailableFiles('undecodable-sounds', distinctFileNames.length, accepted);
    return accepted;
  }

  private async confirmGoingWithoutSounds(plan: ExportRenderPlan): Promise<void> {
    if (plan.unavailableAudio.length === 0) return;
    const accepted = await this.exportPauseCoordinator.pauseAndAwait({
      kind: 'audio-unavailable',
      fileNames: plan.unavailableAudio,
    });
    this.answerUnavailableFiles('sounds', plan.unavailableAudio.length, accepted);
    if (!accepted) throw new DOMException('The export was declined without its sounds.', 'AbortError');
  }

  /**
   * Reports the reader's answer to going on without files, and marks a
   * refusal as the run's reason to stop, so it is not counted as a plain
   * cancel.
   */
  private answerUnavailableFiles(kind: ExportUnavailableFilesKind, fileCount: number, accepted: boolean): void {
    this.runTelemetry.unavailableFilesPrompted(kind, fileCount, accepted);
    if (!accepted) this.exportCancelCoordinator.cancel('declined-missing-files');
  }

  /**
   * The one thing worth saying about the finished file's sound. Sounds
   * left out come first: the reader added them, and the file is missing
   * them whatever became of the video's own sound. A soundtrack that
   * only set the video's level has no sounds to miss.
   */
  private noticeFor(
    format: OutputFormat,
    audioDiscardedReason: AudioDiscardReason | null,
    audioMixDroppedReason: AudioMixDropReason | null,
    soundtrack: PlannedSoundtrack | null,
  ): ExportNotice | null {
    if (audioMixDroppedReason !== null && soundtrack?.hasSounds) return { kind: 'audio-mix-dropped', reason: audioMixDroppedReason, format };
    if (audioDiscardedReason !== null) return { kind: 'audio-discarded', reason: audioDiscardedReason, format };
    return null;
  }

  private audioMixOutcome(
    soundtrack: PlannedSoundtrack | null,
    plan: ExportRenderPlan,
    droppedReason: AudioMixDropReason | null,
    inputFallbackError: string | null,
  ): ExportAudioMixOutcome | null {
    if (soundtrack === null) return null;
    return {
      layerCount: plan.audioMix?.layers.length ?? 0,
      unavailableFileCount: plan.unavailableAudio.length,
      codec: soundtrack.codec,
      droppedReason,
      inputFallbackError,
    };
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    return String(error);
  }

  private isCancellation(err: unknown): boolean {
    return err instanceof Error && err.name === 'AbortError';
  }

  private reportCancellation(options: ExportVideoOptions, elapsedMs: number): void {
    const reason = this.exportCancelCoordinator.reasonForAbort();
    // Write the cleared error before flipping the export state so
    // subscribers that react to the run-ending edge see the fresh
    // slot when they snapshot the editor.
    this.editorStore.patch({ error: null });
    this.exportStore.cancel(reason);
    this.runTelemetry.cancelled({
      options,
      elapsedMs,
      reason,
      progressPercent: this.progressStore.percent,
    });
  }

  private reportFailure(
    err: unknown,
    options: ExportVideoOptions,
    elapsedMs: number,
    visibilitySpan: VisibilitySpan,
    decoderSelection: VideoFrameDecoderSelection | null,
    encoderSelection: VideoEncoderSelection | null,
    videoSource: VideoBlobSource | null,
  ): void {
    const appError = this.runTelemetry.failed({
      error: err,
      options,
      elapsedMs,
      progressPercent: this.progressStore.percent,
      visibility: visibilitySpan,
      decoderSelection,
      encoderSelection,
      videoSource,
    });
    this.editorStore.patch({ error: appError });
    this.exportStore.finish(null);
  }

  private updateProgress(percent: number): void {
    this.progressStore.setPercent(percent);
  }

  /**
   * The bytes a render needs, and which copy answered. Rejects with
   * `OriginalVideoUnavailableError` when no copy could produce
   * readable ones, and with the download's own failure when one was
   * in flight and did not finish.
   */
  private async resolveOriginalVideo(fileInEditor: File | null): Promise<{ file: File; source: VideoBlobSource }> {
    if (fileInEditor !== null) return { file: fileInEditor, source: 'memory' };
    const hadFileInEditor = this.editorStore.snapshot().video.file !== null;
    const resolution = await this.originalVideoResolver.readableFileFromStorage();
    if (resolution.outcome === 'missing') {
      this.runTelemetry.originalVideoUnavailable(resolution.reason, this.hasRemoteCopy());
      throw new OriginalVideoUnavailableError({ hasRemoteCopy: this.hasRemoteCopy() });
    }
    this.exportStore.enterPhase('rendering');
    // A project still streaming its original in has recovered from
    // nothing. Replacing bytes the editor was holding is the event
    // worth counting, and nothing else in the session notices it.
    if (hadFileInEditor) {
      this.runTelemetry.originalVideoRecovered(resolution.source);
    }
    return { file: resolution.file, source: resolution.source };
  }

  // Both halves are required: a session that keeps no project has
  // nothing on a server, whatever this build does with the ones that do.
  private hasRemoteCopy(): boolean {
    return this.videoIsUploaded && this.editorStore.snapshot().projectId !== null;
  }

  /**
   * Checkpoints the project so a render that crashes the tab does not
   * take the session's edits with it. Runs alongside the render rather
   * than ahead of it: how long the write takes depends on the storage
   * behind it, and the user asked for an export, not for a save — the
   * export must not sit behind a write of unbounded duration. Never
   * rejects.
   */
  private async persistAlongsideRender(): Promise<void> {
    try {
      await this.saveProject.execute();
    } catch (cause) {
      // Best-effort: a save failure here must not interrupt an export the
      // user already committed to, and must not land in the editor's
      // error slot, which is what the export itself reports through.
      console.error('[export] auto-save alongside render failed', cause);
      this.saveFailureReporter.report(cause);
    }
  }

  /**
   * Builds and opens the writer for this export. Returns `null` when the
   * writer rejects with `AbortError` (the user dismissed an interactive
   * prompt) so the caller can abort without spending any encoding time.
   */
  private async openWriter(format: OutputFormat): Promise<ExportWriter | null> {
    const writer = this.exportWriterFactory.create();
    try {
      await writer.open(format);
      return writer;
    } catch (err) {
      writer.dispose();
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }

  private triggerDownload(blob: Blob, format: OutputFormat): void {
    this.fileDownloader.download(blob, `subtitled.${format}`);
  }
}
