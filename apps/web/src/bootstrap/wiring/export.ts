import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ExportStore } from '@core/export/store/ExportStore';
import { ExportProgressStore } from '@core/export/store/ExportProgressStore';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import { ExportPauseCoordinator } from '@core/export/services/ExportPauseCoordinator';
import { ExportVideoAction } from '@core/export/actions/ExportVideoAction';
import { SheetCustomizationDiff } from '@core/sheets/services/SheetCustomizationDiff';
import { AcceptExportPauseAction } from '@core/export/actions/AcceptExportPauseAction';
import { RejectExportPauseAction } from '@core/export/actions/RejectExportPauseAction';
import { DismissExportNoticeAction } from '@core/export/actions/DismissExportNoticeAction';
import { DefaultExportWriterFactory } from '@core/editor/infrastructure/DefaultExportWriterFactory';
import type { EngineModule } from '@bootstrap/wiring/engine';
import type { FontsModule } from '@bootstrap/wiring/fonts';
import type { RenderingModule } from '@bootstrap/wiring/rendering';
import type { UtilsModule } from '@bootstrap/wiring/utils';
import type { TelemetryModule } from '@bootstrap/wiring/telemetry';
import type { UserBlobsModule } from '@bootstrap/wiring/user-blobs';

export interface ExportDependencies {
  readonly engine: EngineModule;
  readonly rendering: RenderingModule;
  readonly utils: UtilsModule;
  readonly store: EditorStore;
  readonly fonts: FontsModule;
  readonly overlayResolver: () => string | null;
  readonly runStore: ExportStore;
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
    deps.engine.renderer,
    deps.rendering.sheetCssVarsBuilder,
    deps.rendering.segmentColorRotation,
    deps.fonts.fontFaceCssBuilder,
    deps.rendering.svgFilterDefinitionsResolver,
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
