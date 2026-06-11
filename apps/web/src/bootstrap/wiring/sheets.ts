import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import { SheetColorPalette } from '@core/sheets/services/SheetColorPalette';
import { StyleAssetUsageInspector } from '@core/sheets/services/StyleAssetUsageInspector';
import type { TemplatesModule } from '@bootstrap/wiring/templates';
import type { TelemetryModule } from '@bootstrap/wiring/telemetry';
import { CreateSheetAction } from '@core/sheets/actions/CreateSheetAction';
import { RenameSheetAction } from '@core/sheets/actions/RenameSheetAction';
import { DeleteSheetAction } from '@core/sheets/actions/DeleteSheetAction';
import { AssignSegmentSheetAction } from '@core/sheets/actions/AssignSegmentSheetAction';
import { SetActiveSheetAction } from '@core/sheets/actions/SetActiveSheetAction';
import { CopyStylesFromSheetAction } from '@core/sheets/actions/CopyStylesFromSheetAction';
import { SheetMatcherRegistry } from '@core/sheet-matchers/services/SheetMatcherRegistry';
import { SpeakerSheetMatcher } from '@core/sheet-matchers/services/SpeakerSheetMatcher';
import { RunSheetMatcherAction } from '@core/sheet-matchers/actions/RunSheetMatcherAction';
import { SetTemplateAction } from '@core/sheets/actions/SetTemplateAction';
import { UpdateStyleControlAction } from '@core/sheets/actions/style/UpdateStyleControlAction';
import { UpdateSegmentSplitterConfigAction } from '@core/sheets/actions/style/UpdateSegmentSplitterConfigAction';
import { UpdateLineSplitterConfigAction } from '@core/sheets/actions/style/UpdateLineSplitterConfigAction';
import { UpdateAlignmentAction } from '@core/sheets/actions/style/UpdateAlignmentAction';
import { UpdateTypographyAction } from '@core/sheets/actions/style/UpdateTypographyAction';
import { UpdateRotationAction } from '@core/sheets/actions/style/UpdateRotationAction';
import { UpdateSheetCssOverrideAction } from '@core/sheets/actions/style/UpdateSheetCssOverrideAction';
import { UpdateSheetFiltersSvgOverrideAction } from '@core/sheets/actions/style/UpdateSheetFiltersSvgOverrideAction';
import { UpdateEffectsAction } from '@core/sheets/actions/style/UpdateEffectsAction';
import { ResetSheetSliceAction } from '@core/sheets/actions/style/ResetSheetSliceAction';
import { SetStyleAssetAction } from '@core/sheets/actions/style/SetStyleAssetAction';

export interface SheetsDependencies {
  readonly store: EditorStore;
  readonly refresh: RefreshDocumentAction;
  readonly deriver: DocumentDeriver;
  readonly templates: TemplatesModule;
  readonly telemetry: TelemetryModule;
}

export type SheetsModule = ReturnType<typeof bootSheets>;

/**
 * Boots the sheets feature: per-sheet CRUD actions, the matcher
 * registry plus its single built-in (speaker) auto-assignment matcher,
 * the style-update actions the sidebar drives, and the typography +
 * segment-color services consumed by both the preview overlay and the
 * export pipeline.
 */
export function bootSheets(deps: SheetsDependencies) {
  const palette = new SheetColorPalette();
  const matcherRegistry = new SheetMatcherRegistry([
    new SpeakerSheetMatcher(),
  ]);
  const updateControl = new UpdateStyleControlAction(deps.store, deps.refresh);
  return {
    matcherRegistry,
    palette,
    assetUsageInspector: new StyleAssetUsageInspector(),
    actions: {
      sheets: {
        create: new CreateSheetAction(deps.store, palette),
        rename: new RenameSheetAction(deps.store),
        delete: new DeleteSheetAction(deps.store, deps.refresh),
        assignSegment: new AssignSegmentSheetAction(deps.store, deps.deriver),
        setActive: new SetActiveSheetAction(deps.store),
        copyStylesFromSheet: new CopyStylesFromSheetAction(deps.store, deps.refresh),
        runMatcher: new RunSheetMatcherAction(deps.store, deps.deriver),
      },
      style: {
        setTemplate: new SetTemplateAction(
          deps.store,
          deps.refresh,
          deps.templates.actions.recordUse,
          deps.telemetry.telemetry,
        ),
        updateControl,
        setAsset: new SetStyleAssetAction(updateControl),
        updateSegmentSplitter: new UpdateSegmentSplitterConfigAction(deps.store, deps.refresh),
        updateLineSplitter: new UpdateLineSplitterConfigAction(deps.store, deps.refresh),
        updateAlignment: new UpdateAlignmentAction(deps.store),
        updateRotation: new UpdateRotationAction(deps.store),
        updateTypography: new UpdateTypographyAction(deps.store, deps.refresh),
        updateSheetCssOverride: new UpdateSheetCssOverrideAction(deps.store, deps.refresh),
        updateSheetFiltersSvgOverride: new UpdateSheetFiltersSvgOverrideAction(deps.store, deps.refresh),
        updateEffects: new UpdateEffectsAction(deps.store, deps.refresh),
        resetSlice: new ResetSheetSliceAction(deps.store, deps.refresh),
      },
    },
  };
}
