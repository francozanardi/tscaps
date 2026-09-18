import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { ExportVideoOptions } from '@core/export/actions/ExportVideoAction';
import type { ExportSubtitlesOptions } from '@core/export/actions/ExportSubtitlesAction';
import type { ExportNotice } from '@core/export/domain/ExportNotice';
import type { ExportRun, ExportPauseReason } from '@core/export/domain/ExportRun';
import type { UserAgentInspector } from '@shared/browser';
import type { AppError } from '@core/errors/domain/AppError';
import {
  ExportDialog,
  type ExportDialogPhase,
  type FallbackDecoderWarning,
} from '@ui/pages/editor/features/export/components/ExportDialog';
import type { ResolutionView } from '@ui/pages/editor/features/export/components/VideoExportSettings';

interface ExportFlowProps {
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  exportRun: ExportRun | null;
  exportError: AppError | null;
  exportNotice: ExportNotice | null;
  videoLayout: { width: number; height: number } | null;
  fallbackWarning: FallbackDecoderWarning | null;
  resolutionView: ResolutionView | null;
  extraNotice?: ReactNode;
  onExportVideo: (options: ExportVideoOptions) => Promise<void> | void;
  onExportSubtitles: (options: ExportSubtitlesOptions) => void;
  onAcceptExportPause: () => void;
  onRejectExportPause: () => void;
  onDismissExportNotice: () => void;
  onDismissExportError: () => void;
  onSelectOriginalVideo: (file: File) => void;
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
  onExportVideo,
  onExportSubtitles,
  onAcceptExportPause,
  onRejectExportPause,
  onDismissExportNotice,
  onDismissExportError,
  onSelectOriginalVideo,
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
    if (exportError) onDismissExportError();
    onSettingsOpenChange(false);
  }, [isExporting, exportError, onDismissExportError, onSettingsOpenChange]);

  const handleDismissNotice = useCallback(() => {
    onDismissExportNotice();
    onSettingsOpenChange(false);
  }, [onDismissExportNotice, onSettingsOpenChange]);

  const cloudProps = {};
  return (
    <ExportDialog
      open={settingsOpen}
      phase={phase}
      isExporting={isExporting}
      error={exportError}
      fallbackWarning={fallbackWarning}
      notice={exportNotice}
      videoLayout={videoLayout}
      {...cloudProps}
      resolutionView={resolutionView}
      extraNotice={extraNotice}
      onExportVideo={onExportVideo}
      onExportSubtitles={onExportSubtitles}
      onAcceptFallback={onAcceptExportPause}
      onRejectFallback={onRejectExportPause}
      onDismissNotice={handleDismissNotice}
      onSelectOriginalVideo={onSelectOriginalVideo}
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
