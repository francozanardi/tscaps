import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ExportStore } from '@core/export/store/ExportStore';
import { ExportProgressStore } from '@core/export/store/ExportProgressStore';
import type { VideosModule } from '@bootstrap/wiring/videos';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import { ExportPauseCoordinator } from '@core/export/services/ExportPauseCoordinator';
import { ExportCancelCoordinator } from '@core/export/services/ExportCancelCoordinator';
import { ExportVideoAction } from '@core/export/actions/ExportVideoAction';
import { ExportDialogRequestStore } from '@core/export/store/ExportDialogRequestStore';
import { ExportRenderPlanner } from '@core/export/services/ExportRenderPlanner';
import { ExportRenderPlanRequestBuilder } from '@core/export/services/ExportRenderPlanRequestBuilder';
import { ExportRenderJobBuilder } from '@core/export/services/ExportRenderJobBuilder';
import { ProjectFrameRenderer } from '@core/export/services/ProjectFrameRenderer';
import type { ExportRenderOutsideInput } from '@core/export/domain/ExportRenderOutsideInput';
import { SubtitleStyleSetBuilder } from '@core/export/services/SubtitleStyleSetBuilder';
import { VideoDependentStyleDetector } from '@core/export/services/VideoDependentStyleDetector';
import { ExportSubtitlesAction } from '@core/export/actions/ExportSubtitlesAction';
import { SubtitleFileSerializerRegistry } from '@core/export/services/SubtitleFileSerializerRegistry';
import { DocumentUsedCodepointCollector } from '@core/fonts/services/DocumentUsedCodepointCollector';
import { SheetCustomizationDiff } from '@core/sheets/services/SheetCustomizationDiff';
import { ExportRunTelemetry } from '@core/export/services/ExportRunTelemetry';
import { VideoCompositionTelemetryDescriber } from '@core/export/services/VideoCompositionTelemetryDescriber';
import { ColorGradeLooks } from '@core/color-grade/domain/ColorGradeLook';
import type { GraphicTelemetryDescriber } from '@core/graphics/services/GraphicTelemetryDescriber';
import type { ExportRenderContributor } from '@core/export/domain/ExportRenderContributor';
import { AcceptExportPauseAction } from '@core/export/actions/AcceptExportPauseAction';
import { RejectExportPauseAction } from '@core/export/actions/RejectExportPauseAction';
import { CancelExportAction } from '@core/export/actions/CancelExportAction';
import { DismissExportNoticeAction } from '@core/export/actions/DismissExportNoticeAction';
import { DismissExportErrorAction } from '@core/export/actions/DismissExportErrorAction';
import { RedirectableExportWriterFactory } from '@core/export/services/RedirectableExportWriterFactory';
import { DefaultExportWriterFactory } from '@core/export/infrastructure/DefaultExportWriterFactory';
import { MediaBunnyAudioMixEncodeSupport } from '@core/export/infrastructure/MediaBunnyAudioMixEncodeSupport';
import type { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import type { CutsModule } from '@bootstrap/wiring/cuts';
import type { EngineModule } from '@bootstrap/wiring/engine';
import type { FontsModule } from '@bootstrap/wiring/fonts';
import type { RenderingModule } from '@bootstrap/wiring/rendering';
import type { SheetsModule } from '@bootstrap/wiring/sheets';
import type { UtilsModule } from '@bootstrap/wiring/utils';
import type { TelemetryModule } from '@bootstrap/wiring/telemetry';
import type { UserBlobsModule } from '@bootstrap/wiring/user-blobs';
import type { WorkerErrorMonitor } from '@core/_shared/workers/WorkerErrorMonitor';
import { DocumentVisibilityTracker } from '@core/_shared/infrastructure/DocumentVisibilityTracker';
import { UnrestrictedExportAccessPolicy } from '@core/export/services/UnrestrictedExportAccessPolicy';

export interface ExportDependencies {
  readonly engine: EngineModule;
  readonly rendering: RenderingModule;
  readonly sheets: SheetsModule;
  readonly cuts: CutsModule;
  readonly utils: UtilsModule;
  readonly workerErrorMonitor: WorkerErrorMonitor;
  readonly store: EditorStore;
  readonly fonts: FontsModule;
  readonly overlayResolver: () => string | null;
  readonly runStore: ExportStore;
  readonly videos: VideosModule;
  /** Whether this session's projects keep their video on a server. */
  readonly videoIsUploaded: boolean;
  readonly saveProject: SaveProjectAction;
  readonly saveFailureReporter: NonBlockingFailureReporter;
  readonly errorTelemetryDescriber: AppErrorTelemetryDescriber;
  readonly telemetry: TelemetryModule;
  readonly userBlobs: UserBlobsModule;
  readonly renderContributors: ReadonlyArray<ExportRenderContributor>;
  /** What a picture of a single frame is planned with: the render's, less anything that waits or plays sound. */
  readonly stillRenderContributors: ReadonlyArray<ExportRenderContributor>;
  /** What those contributors read outside the editor's state, which a picture kept open must follow. */
  readonly stillRenderOutsideInputs: ReadonlyArray<ExportRenderOutsideInput>;
  /** The media files the open project can use, which its shots name. */
  readonly mediaAssets: MediaAssetStore;
  /** Names a graphic's preset in terms safe to report. */
  readonly graphicTelemetry: GraphicTelemetryDescriber;
  /** Where what is said in the video is read, which the soundtrack's word anchors follow. */
  readonly originalCaptions: OriginalCaptionTrackReader;
}

export type ExportModule = ReturnType<typeof bootExport>;

/**
 * Boots the export feature: the lifecycle store, the per-frame
 * progress store, the pause coordinator that the pause/resume actions
 * mutate, the cancel coordinator that abandons a run in flight, the
 * export writer factory (filesystem-handle on desktop,
 * blob fallback on mobile), what says before a run which codec its
 * soundtrack would be written with, the action that drives a full
 * export run, and the action that writes the captions out as a subtitle
 * file. `services.frameRenderer` paints pictures of the output frame at
 * given times through the export's own plan and compositing, for an
 * assistant to see its work. `services.writerFactory` lets a run started
 * from outside the export dialog send its bytes somewhere other than a
 * download.
 */
export function bootExport(deps: ExportDependencies) {
  const accessPolicy = new UnrestrictedExportAccessPolicy();
  const progressStore = new ExportProgressStore();
  const pauseCoordinator = new ExportPauseCoordinator(deps.runStore);
  const cancelCoordinator = new ExportCancelCoordinator();
  const writerFactory = new RedirectableExportWriterFactory(
    new DefaultExportWriterFactory(deps.utils.userAgentInspector, deps.workerErrorMonitor),
  );
  const audioMixEncodeSupport = new MediaBunnyAudioMixEncodeSupport(deps.engine.audioMixCodecs);
  const styleSetBuilder = new SubtitleStyleSetBuilder(
    deps.rendering.sheetCssVarsBuilder,
    deps.rendering.layeredCaptionCssBuilder,
    deps.rendering.captionFontOverridesBuilder,
    deps.rendering.segmentColorRotation,
    deps.rendering.sheetFontFacesBuilder,
    new DocumentUsedCodepointCollector(),
    deps.rendering.svgFilterDefinitionsResolver,
    deps.sheets.decorationPlacementResolver,
    deps.rendering.segmentSubtreeOverridesBuilder,
  );
  const planner = new ExportRenderPlanner(
    deps.cuts.services.cutAwareDocumentBuilder,
    deps.sheets.decorationFilter,
    styleSetBuilder,
    deps.renderContributors,
    deps.overlayResolver,
  );
  // No overlay: a picture of the output shows the project's own work, and nothing laid over every export.
  const stillPlanner = new ExportRenderPlanner(
    deps.cuts.services.cutAwareDocumentBuilder,
    deps.sheets.decorationFilter,
    styleSetBuilder,
    deps.stillRenderContributors,
  );
  const planRequests = new ExportRenderPlanRequestBuilder();
  const jobs = new ExportRenderJobBuilder();
  const runTelemetry = new ExportRunTelemetry(
    deps.telemetry.telemetry,
    deps.store,
    new SheetCustomizationDiff(),
    deps.errorTelemetryDescriber,
    new VideoCompositionTelemetryDescriber(deps.mediaAssets, deps.graphicTelemetry, new ColorGradeLooks()),
  );
  const run = new ExportVideoAction(
    deps.store,
    deps.runStore,
    deps.videos.resolver,
    deps.engine.renderer,
    planner,
    pauseCoordinator,
    cancelCoordinator,
    writerFactory,
    deps.utils.fileDownloader,
    progressStore,
    deps.saveProject,
    runTelemetry,
    deps.saveFailureReporter,
    new DocumentVisibilityTracker(),
    accessPolicy,
    deps.videoIsUploaded,
    deps.mediaAssets,
    deps.originalCaptions,
    audioMixEncodeSupport,
    planRequests,
    jobs,
  );
  const runSubtitles = new ExportSubtitlesAction(
    deps.store,
    deps.cuts.services.cutAwareDocumentBuilder,
    new SubtitleFileSerializerRegistry(),
    deps.utils.fileDownloader,
    deps.telemetry.telemetry,
    accessPolicy,
  );
  return {
    runStore: deps.runStore,
    progressStore,
    dialogRequests: new ExportDialogRequestStore(),
    accessPolicy,
    audioMixEncodeSupport,
    videoDependentStyles: new VideoDependentStyleDetector(),
    services: {
      writerFactory,
      frameRenderer: new ProjectFrameRenderer(
        deps.store,
        deps.mediaAssets,
        deps.videos.resolver,
        planRequests,
        stillPlanner,
        jobs,
        deps.engine.stillFrameRenderer,
        deps.stillRenderOutsideInputs,
      ),
    },
    actions: {
      run,
      runSubtitles,
      acceptPause: new AcceptExportPauseAction(pauseCoordinator),
      rejectPause: new RejectExportPauseAction(pauseCoordinator),
      cancel: new CancelExportAction(cancelCoordinator, pauseCoordinator),
      dismissNotice: new DismissExportNoticeAction(deps.runStore),
      dismissError: new DismissExportErrorAction(deps.store),
    },
  };
}
