import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ExportStore } from '@core/export/store/ExportStore';
import { ExportProgressStore } from '@core/export/store/ExportProgressStore';
import type { OriginalVideoDownloadStore } from '@core/projects/store/OriginalVideoDownloadStore';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import { ExportPauseCoordinator } from '@core/export/services/ExportPauseCoordinator';
import { ExportVideoAction } from '@core/export/actions/ExportVideoAction';
import { SheetFontFamilyCollector } from '@core/fonts/services/SheetFontFamilyCollector';
import { DocumentUsedCodepointCollector } from '@core/fonts/services/DocumentUsedCodepointCollector';
import { SheetCustomizationDiff } from '@core/sheets/services/SheetCustomizationDiff';
import { AcceptExportPauseAction } from '@core/export/actions/AcceptExportPauseAction';
import { RejectExportPauseAction } from '@core/export/actions/RejectExportPauseAction';
import { DismissExportNoticeAction } from '@core/export/actions/DismissExportNoticeAction';
import { DefaultExportWriterFactory } from '@core/export/infrastructure/DefaultExportWriterFactory';
import type { CutsModule } from '@bootstrap/wiring/cuts';
import type { EngineModule } from '@bootstrap/wiring/engine';
import type { FontsModule } from '@bootstrap/wiring/fonts';
import type { RenderingModule } from '@bootstrap/wiring/rendering';
import type { SheetsModule } from '@bootstrap/wiring/sheets';
import type { UtilsModule } from '@bootstrap/wiring/utils';
import type { TelemetryModule } from '@bootstrap/wiring/telemetry';
import type { UserBlobsModule } from '@bootstrap/wiring/user-blobs';

export interface ExportDependencies {
  readonly engine: EngineModule;
  readonly rendering: RenderingModule;
  readonly sheets: SheetsModule;
  readonly cuts: CutsModule;
  readonly utils: UtilsModule;
  readonly store: EditorStore;
  readonly fonts: FontsModule;
  readonly overlayResolver: () => string | null;
  readonly runStore: ExportStore;
  readonly originalVideoDownloadStore: OriginalVideoDownloadStore;
  readonly saveProject: SaveProjectAction;
  readonly telemetry: TelemetryModule;
  readonly userBlobs: UserBlobsModule;
}

export type ExportModule = ReturnType<typeof bootExport>;

/**
 * Boots the export feature: the lifecycle store, the per-frame
 * progress store, the pause coordinator that the pause/resume actions
 * mutate, the export writer factory (filesystem-handle on desktop,
 * blob fallback on mobile), and the action that drives a full export
 * run.
 */
export function bootExport(deps: ExportDependencies) {
  const progressStore = new ExportProgressStore();
  const pauseCoordinator = new ExportPauseCoordinator(deps.runStore);
  const writerFactory = new DefaultExportWriterFactory(deps.utils.userAgentInspector);
  const run = new ExportVideoAction(
    deps.store,
    deps.runStore,
    deps.originalVideoDownloadStore,
    deps.engine.renderer,
    deps.rendering.sheetCssVarsBuilder,
    deps.rendering.segmentColorRotation,
    deps.fonts.fontFaceCssBuilder,
    new SheetFontFamilyCollector(),
    new DocumentUsedCodepointCollector(),
    deps.rendering.svgFilterDefinitionsResolver,
    deps.sheets.decorationPlacementResolver,
    deps.sheets.decorationFilter,
    deps.cuts.services.cutAwareDocumentBuilder,
    pauseCoordinator,
    writerFactory,
    progressStore,
    deps.saveProject,
    deps.telemetry.telemetry,
    new SheetCustomizationDiff(),
    deps.overlayResolver,
  );
  return {
    runStore: deps.runStore,
    progressStore,
    actions: {
      run,
      acceptPause: new AcceptExportPauseAction(pauseCoordinator),
      rejectPause: new RejectExportPauseAction(pauseCoordinator),
      dismissNotice: new DismissExportNoticeAction(deps.runStore),
    },
  };
}
