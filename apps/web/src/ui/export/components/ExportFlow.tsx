import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { ExportVideoOptions } from '@core/export/actions/ExportVideoAction';
import type { ExportNotice } from '@core/export/domain/ExportNotice';
import type { ExportRun, ExportPauseReason } from '@core/export/domain/ExportRun';
import type { UserAgentInspector } from '@core/_shared/UserAgentInspector';
import {
  ExportDialog,
  type ExportDialogPhase,
  type FallbackDecoderWarning,
} from '@ui/export/components/ExportDialog';
import type { ResolutionView } from '@ui/export/components/ExportSettingsForm';

interface ExportFlowProps {
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  exportRun: ExportRun | null;
  exportError: string | null;
  exportNotice: ExportNotice | null;
  videoLayout: { width: number; height: number } | null;
  fallbackWarning: FallbackDecoderWarning | null;
  resolutionView: ResolutionView | null;
  extraNotice?: ReactNode;
  onExport: (options: ExportVideoOptions) => void;
  onAcceptExportPause: () => void;
  onRejectExportPause: () => void;
  onDismissExportNotice: () => void;
  userAgentInspector: UserAgentInspector;
}

/**
 * Renders the export settings / fallback-warning / error / notice
 * dialog and chooses which phase to surface based on `exportRun`,
 * `exportError` and `exportNotice`. Settings is the only phase the
 * user opens directly (via `settingsOpen`); the rest are raised
 * implicitly when the corresponding signal becomes truthy.
 *
 * No UI is rendered for the encoding phase itself — that surface
 * belongs to a separate full-screen component.
 */
export function ExportFlow({
  settingsOpen,
  onSettingsOpenChange,
  exportRun,
  exportError,
  exportNotice,
  videoLayout,
  fallbackWarning,
  resolutionView,
  extraNotice,
  onExport,
  onAcceptExportPause,
  onRejectExportPause,
  onDismissExportNotice,
  userAgentInspector,
}: ExportFlowProps) {
  const isExporting = exportRun !== null;
  const pause = exportRun?.pause ?? null;
  const wasExportingRef = useRef(false);

  // Edge detection on `isExporting` requires previous-vs-current.
  useEffect(() => {
    if (pause) {
      onSettingsOpenChange(true);
    } else if (isExporting) {
      onSettingsOpenChange(false);
    } else if (wasExportingRef.current) {
      onSettingsOpenChange(Boolean(exportError || exportNotice));
    }
    wasExportingRef.current = isExporting;
  }, [isExporting, exportError, exportNotice, pause, onSettingsOpenChange]);

  const phase = useMemo<ExportDialogPhase>(() => {
    if (pause) return pauseToPhase(pause);
    if (exportError) return 'error';
    if (exportNotice) return 'notice';
    return 'settings';
  }, [pause, exportError, exportNotice]);

  const handleClose = useCallback(() => {
    if (isExporting) return;
    onSettingsOpenChange(false);
  }, [isExporting, onSettingsOpenChange]);

  const handleDismissNotice = useCallback(() => {
    onDismissExportNotice();
    onSettingsOpenChange(false);
  }, [onDismissExportNotice, onSettingsOpenChange]);

  return (
    <ExportDialog
      open={settingsOpen}
      phase={phase}
      isExporting={isExporting}
      error={exportError}
      fallbackWarning={fallbackWarning}
      notice={exportNotice}
      videoLayout={videoLayout}
      resolutionView={resolutionView}
      extraNotice={extraNotice}
      onConfirm={onExport}
      onAcceptFallback={onAcceptExportPause}
      onRejectFallback={onRejectExportPause}
      onDismissNotice={handleDismissNotice}
      onClose={handleClose}
      userAgentInspector={userAgentInspector}
    />
  );
}

function pauseToPhase(pause: ExportPauseReason): ExportDialogPhase {
  switch (pause.kind) {
    case 'fallback-decoder': return 'fallback-warning';
  }
}
