import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ExportStore } from '@core/export/store/ExportStore';
import { ExportProgressStore } from '@core/export/store/ExportProgressStore';
import type { VideosModule } from '@bootstrap/wiring/videos';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import { ExportPauseCoordinator } from '@core/export/services/ExportPauseCoordinator';
import { ExportVideoAction } from '@core/export/actions/ExportVideoAction';
import { ExportRenderPlanner } from '@core/export/services/ExportRenderPlanner';
import { SubtitleStyleSetBuilder } from '@core/export/services/SubtitleStyleSetBuilder';
import { ExportSubtitlesAction } from '@core/export/actions/ExportSubtitlesAction';
import { SubtitleFileSerializerRegistry } from '@core/export/services/SubtitleFileSerializerRegistry';
import { DocumentUsedCodepointCollector } from '@core/fonts/services/DocumentUsedCodepointCollector';
import { SheetCustomizationDiff } from '@core/sheets/services/SheetCustomizationDiff';
import { ExportRunTelemetry } from '@core/export/services/ExportRunTelemetry';
import type { ExportRenderContributor } from '@core/export/domain/ExportRenderContributor';
import { AcceptExportPauseAction } from '@core/export/actions/AcceptExportPauseAction';
import { RejectExportPauseAction } from '@core/export/actions/RejectExportPauseAction';
import { DismissExportNoticeAction } from '@core/export/actions/DismissExportNoticeAction';
import { DismissExportErrorAction } from '@core/export/actions/DismissExportErrorAction';
import { DefaultExportWriterFactory } from '@core/export/infrastructure/DefaultExportWriterFactory';
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
}

export type ExportModule = ReturnType<typeof bootExport>;

/**
 * Boots the export feature: the lifecycle store, the per-frame
 * progress store, the pause coordinator that the pause/resume actions
 * mutate, the export writer factory (filesystem-handle on desktop,
 * blob fallback on mobile), the action that drives a full export run,
 * and the action that writes the captions out as a subtitle file.
 */
export function bootExport(deps: ExportDependencies) {
  const accessPolicy = new UnrestrictedExportAccessPolicy();
  const progressStore = new ExportProgressStore();
  const pauseCoordinator = new ExportPauseCoordinator(deps.runStore);
  const writerFactory = new DefaultExportWriterFactory(deps.utils.userAgentInspector, deps.workerErrorMonitor);
  const styleSetBuilder = new SubtitleStyleSetBuilder(
    deps.rendering.sheetCssVarsBuilder,
    deps.rendering.layeredCaptionCssBuilder,
    deps.rendering.captionFontOverridesBuilder,
    deps.rendering.segmentColorRotation,
    deps.rendering.sheetFontFacesBuilder,
    new DocumentUsedCodepointCollector(),
    deps.rendering.svgFilterDefinitionsResolver,
    deps.sheets.decorationPlacementResolver,
  );
  const planner = new ExportRenderPlanner(
    deps.cuts.services.cutAwareDocumentBuilder,
    deps.sheets.decorationFilter,
    styleSetBuilder,
    deps.renderContributors,
    deps.overlayResolver,
  );
  const runTelemetry = new ExportRunTelemetry(
    deps.telemetry.telemetry,
    deps.store,
    new SheetCustomizationDiff(),
    deps.errorTelemetryDescriber,
  );
  const run = new ExportVideoAction(
    deps.store,
    deps.runStore,
    deps.videos.resolver,
    deps.engine.renderer,
    planner,
    pauseCoordinator,
    writerFactory,
    deps.utils.fileDownloader,
    progressStore,
    deps.saveProject,
    runTelemetry,
    deps.saveFailureReporter,
    new DocumentVisibilityTracker(),
    accessPolicy,
    deps.videoIsUploaded,
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
    accessPolicy,
    actions: {
      run,
      runSubtitles,
      acceptPause: new AcceptExportPauseAction(pauseCoordinator),
      rejectPause: new RejectExportPauseAction(pauseCoordinator),
      dismissNotice: new DismissExportNoticeAction(deps.runStore),
      dismissError: new DismissExportErrorAction(deps.store),
    },
  };
}
