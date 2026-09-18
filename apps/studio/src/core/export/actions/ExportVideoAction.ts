import type { VideoRenderer, OutputFormat, RenderQuality, AudioDiscardReason, VideoFrameDecoderSelection } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { FileDownloader } from '@core/_shared/domain/FileDownloader';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ExportPauseCoordinator } from '@core/export/services/ExportPauseCoordinator';
import type { ExportWriter } from '@core/export/domain/ExportWriter';
import type { ExportWriterFactory } from '@core/export/domain/ExportWriterFactory';
import type { ExportProgressStore } from '@core/export/store/ExportProgressStore';
import type { ExportStore } from '@core/export/store/ExportStore';
import type { ExportRenderPlan, ExportRenderPlanner } from '@core/export/services/ExportRenderPlanner';
import type { OriginalVideoResolver } from '@core/videos/services/OriginalVideoResolver';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import type { ExportRunTelemetry } from '@core/export/services/ExportRunTelemetry';
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
 */
export class ExportVideoAction {

  constructor(
    private readonly editorStore: EditorStore,
    private readonly exportStore: ExportStore,
    private readonly originalVideoResolver: OriginalVideoResolver,
    private readonly renderer: VideoRenderer,
    private readonly planner: ExportRenderPlanner,
    private readonly exportPauseCoordinator: ExportPauseCoordinator,
    private readonly exportWriterFactory: ExportWriterFactory,
    private readonly fileDownloader: FileDownloader,
    private readonly progressStore: ExportProgressStore,
    private readonly saveProject: SaveProjectAction,
    private readonly runTelemetry: ExportRunTelemetry,
    private readonly saveFailureReporter: NonBlockingFailureReporter,
    private readonly visibilityTracker: VisibilityTracker,
    private readonly accessPolicy: ExportAccessPolicy,
    private readonly videoIsUploaded: boolean,
  ) {}

  async execute(options: ExportVideoOptions): Promise<void> {
    const state = this.editorStore.snapshot();
    if (!this.accessPolicy.access(state).available) return;
    const {
      video,
      projectId,
      cuts,
      document,
      sheets,
      behindActorOverrides,
      elementStyles,
      decorationOverrides,
    } = state;
    if (!document || sheets.length === 0 || video.fileName === null) return;

    const plan = await this.planner.plan({
      document,
      sheets,
      elementStyles,
      decorationOverrides,
      cuts,
      behindActorOverrides,
      projectId,
      videoLayout: video.layout,
    });

    // Open the writer before the heavy work: if the user cancels an
    // interactive prompt we abort without spending any encoding time.
    const writer = await this.openWriter(options.format);
    if (!writer) return;

    // The phase follows what can be read, not what the store holds: a
    // picked file whose bytes have gone away leaves the run waiting on
    // storage like a project whose original is still in flight.
    const fileInEditor = await this.originalVideoResolver.readableFileInEditor();

    this.progressStore.reset();
    this.exportStore.start(fileInEditor !== null ? 'rendering' : 'awaiting-original');
    this.editorStore.patch({ error: null });

    void this.persistAlongsideRender();

    await this.runRender(plan, options, writer, sheets, fileInEditor);
  }

  private async runRender(
    plan: ExportRenderPlan,
    options: ExportVideoOptions,
    writer: ExportWriter,
    sheets: readonly Sheet[],
    fileInEditor: File | null,
  ): Promise<void> {
    let audioDiscardedReason: AudioDiscardReason | null = null;
    let decoderSelection: VideoFrameDecoderSelection | null = null;
    let videoSource: VideoBlobSource | null = null;
    console.time('[export] total');
    const startedAt = performance.now();
    const visibilitySpan = this.visibilityTracker.begin();
    this.runTelemetry.started(options, sheets);
    try {
      const resolved = await this.resolveOriginalVideo(fileInEditor);
      videoSource = resolved.source;
      const videoFile = resolved.file;
      await this.renderer.render(
        {
          video: videoFile,
          document: plan.document,
          styles: plan.styles,
          ...(plan.overlayHtml ? { overlayHtml: plan.overlayHtml } : {}),
          ...(plan.topLayer ? { topLayer: plan.topLayer } : {}),
          outputFormat: options.format,
          quality: options.quality,
          ...(options.resolution !== 'original' ? { outputResolution: options.resolution } : {}),
          outputStream: writer.stream(),
          ...(plan.skipRanges.length === 0 ? {} : { skipRanges: plan.skipRanges }),
          confirmFallbackDecoder: (info) => this.exportPauseCoordinator.pauseAndAwait({
            kind: 'fallback-decoder',
            codec: info.inputCodec,
          }),
          onAudioDiscarded: (reason) => { audioDiscardedReason = reason; },
          onVideoFrameDecoderSelected: (selection) => { decoderSelection = selection; },
        },
        (p) => this.updateProgress(p.percent),
      );

      const file = await writer.finalize();
      if (file) this.triggerDownload(file, options.format);

      this.exportStore.finish(
        audioDiscardedReason !== null
          ? { kind: 'audio-discarded', reason: audioDiscardedReason }
          : null,
      );
      this.runTelemetry.completed({
        options,
        elapsedMs: Math.round(performance.now() - startedAt),
        sheets,
        audioDiscardedReason,
        decoderSelection,
        videoSource,
      });
    } catch (err) {
      await writer.abort();
      const elapsedMs = Math.round(performance.now() - startedAt);
      if (this.isCancellation(err)) {
        this.reportCancellation(options, elapsedMs);
      } else {
        this.reportFailure(err, options, elapsedMs, visibilitySpan, decoderSelection, videoSource);
      }
    } finally {
      visibilitySpan.end();
      console.timeEnd('[export] total');
      writer.dispose();
    }
  }

  private isCancellation(err: unknown): boolean {
    return err instanceof Error && err.name === 'AbortError';
  }

  private reportCancellation(options: ExportVideoOptions, elapsedMs: number): void {
    // Write the cleared error before flipping the export state so
    // subscribers that react to the run-ending edge see the fresh
    // slot when they snapshot the editor.
    this.editorStore.patch({ error: null });
    this.exportStore.finish(null);
    this.runTelemetry.cancelled(options, elapsedMs);
  }

  private reportFailure(
    err: unknown,
    options: ExportVideoOptions,
    elapsedMs: number,
    visibilitySpan: VisibilitySpan,
    decoderSelection: VideoFrameDecoderSelection | null,
    videoSource: VideoBlobSource | null,
  ): void {
    const appError = this.runTelemetry.failed({
      error: err,
      options,
      elapsedMs,
      progressPercent: this.progressStore.percent,
      visibility: visibilitySpan,
      decoderSelection,
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
    this.exportStore.enterRenderingPhase();
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
