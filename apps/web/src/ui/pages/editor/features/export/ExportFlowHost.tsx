import { useEffect, useMemo, useState } from 'react';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { ExportVideoOptions } from '@core/export/actions/ExportVideoAction';
import type { ExportStore } from '@core/export/store/ExportStore';
import type { ExportRun } from '@core/export/domain/ExportRun';
import type { ExportNotice } from '@core/export/domain/ExportNotice';
import { ExportResolutionPresets } from '@presentation/export/services/ExportResolutionPresets';
import { FallbackDecoderAdvisor } from '@presentation/export/services/FallbackDecoderAdvisor';
import { ExportFlow } from '@ui/pages/editor/features/export/components/ExportFlow';
import type { FallbackDecoderWarning } from '@ui/pages/editor/features/export/components/ExportDialog';
import type { ResolutionView } from '@ui/pages/editor/features/export/components/ExportSettingsForm';
import { useExport } from '@ui/_shared/contexts/modules/ExportContext';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useUtils } from '@ui/_shared/contexts/modules/UtilsContext';

interface ExportFlowHostProps {
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
}

function useEditorSnapshot(store: EditorStore): EditorState {
  const [state, setState] = useState(() => store.snapshot());
  useEffect(() => {
    const update = () => setState(store.snapshot());
    store.addEventListener('change', update);
    update();
    return () => store.removeEventListener('change', update);
  }, [store]);
  return state;
}

interface ExportLifecycleSnapshot {
  readonly run: ExportRun | null;
  readonly notice: ExportNotice | null;
}

function useExportLifecycle(runStore: ExportStore): ExportLifecycleSnapshot {
  const [snapshot, setSnapshot] = useState<ExportLifecycleSnapshot>(() => ({
    run: runStore.run,
    notice: runStore.notice,
  }));
  useEffect(() => {
    const update = () => setSnapshot({ run: runStore.run, notice: runStore.notice });
    runStore.addEventListener('change', update);
    update();
    return () => runStore.removeEventListener('change', update);
  }, [runStore]);
  return snapshot;
}

/**
 * Hosts the export dialog. Subscribes to the export state store for
 * the run/notice lifecycle and to the editor state for the project
 * layout, thumbnail, and error message; derives the fallback-decoder
 * warning from the supplied advisor and environment when an export
 * pauses on that reason; and wires action instances to the dialog's
 * callbacks.
 *
 * Lives outside the editor surface so the dialog can mount both in the
 * normal editor branch (settings opened from the toolbar) and on top
 * of the exporting splash (pause / error / notice mid-export).
 */
export function ExportFlowHost({
  settingsOpen,
  onSettingsOpenChange,
}: ExportFlowHostProps) {
  const editor = useEditor();
  const exports = useExport();
  const { userAgentInspector } = useUtils();
  const state = useEditorSnapshot(editor.store);
  const { run, notice } = useExportLifecycle(exports.runStore);
  const extraNotice = null;
  const environment = useMemo(() => userAgentInspector.detect(), [userAgentInspector]);
  const resolutionPresets = useMemo(() => new ExportResolutionPresets(), []);
  const fallbackDecoderAdvisor = useMemo(() => new FallbackDecoderAdvisor(), []);

  const pause = run?.pause ?? null;
  const fallbackWarning = useMemo<FallbackDecoderWarning | null>(() => {
    if (!pause || pause.kind !== 'fallback-decoder') return null;
    const advice = fallbackDecoderAdvisor.adviseFor(pause.codec, environment);
    return {
      humanCodec: advice.humanCodec,
      humanBrowser: environment.humanBrowser,
      humanOs: environment.humanOs,
      reEncodeTo: advice.reEncodeTo,
      betterBrowser: advice.betterBrowser,
    };
  }, [pause, fallbackDecoderAdvisor, environment]);

  const videoLayout = state.video.layout;
  const resolutionView = useMemo<ResolutionView | null>(() => {
    if (!videoLayout) return null;
    return {
      catalog: resolutionPresets.forInput(videoLayout.width, videoLayout.height),
      verticalDownscaleApplied: resolutionPresets.isVerticalDownscaleDefault(videoLayout.width, videoLayout.height),
      sourceDescription: resolutionPresets.describe(videoLayout.width, videoLayout.height),
    };
  }, [resolutionPresets, videoLayout]);

  const handleExport = (options: ExportVideoOptions): Promise<void> =>
    exports.actions.run.execute(options);

  return (
    <ExportFlow
      settingsOpen={settingsOpen}
      onSettingsOpenChange={onSettingsOpenChange}
      exportRun={run}
      exportError={state.error}
      exportNotice={notice}
      videoLayout={state.video.layout}
      extraNotice={extraNotice}
      fallbackWarning={fallbackWarning}
      resolutionView={resolutionView}
      onExport={handleExport}
      onAcceptExportPause={() => exports.actions.acceptPause.execute()}
      onRejectExportPause={() => exports.actions.rejectPause.execute()}
      onDismissExportNotice={() => exports.actions.dismissNotice.execute()}
      userAgentInspector={userAgentInspector}
    />
  );
}
