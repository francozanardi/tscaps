import { useState, type ReactNode } from 'react';
import type { ExportVideoOptions } from '@core/export/actions/ExportVideoAction';
import type { ExportSubtitlesOptions } from '@core/export/actions/ExportSubtitlesAction';
import type { ExportNotice } from '@core/export/domain/ExportNotice';
import type { UserAgentInspector } from '@shared/browser';
import type { AppError } from '@core/errors/domain/AppError';
import type { OriginalVideoUnavailableError } from '@core/videos/domain/errors/OriginalVideoUnavailableError';
import { AppDialog, AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { AppErrorMessage, getAppErrorTitle } from '@ui/_shared/components/AppErrorMessage/AppErrorMessage';
import { BTN_PRIMARY_SM } from '@ui/_shared/styles/buttons';
import { VideoFilePickerButton } from '@ui/_shared/components/VideoFilePickerButton';
import {
  VideoExportSettings,
  type ResolutionView,
} from '@ui/pages/editor/features/export/components/VideoExportSettings';
import { SubtitleExportSettings } from '@ui/pages/editor/features/export/components/SubtitleExportSettings';
import { FallbackDecoderWarningView } from '@ui/pages/editor/features/export/components/FallbackDecoderWarningView';
import { ExportNoticeView } from '@ui/pages/editor/features/export/components/ExportNoticeView';

export type ExportDialogPhase = 'settings' | 'fallback-warning' | 'error' | 'notice';

export interface FallbackDecoderWarning {
  humanCodec: string;
  humanBrowser: string;
  humanOs: string;
  reEncodeTo: { format: string; codec: string };
  betterBrowser: string | null;
}

interface ExportDialogProps {
  open: boolean;
  phase: ExportDialogPhase;
  isExporting: boolean;
  error: AppError | null;
  fallbackWarning: FallbackDecoderWarning | null;
  notice: ExportNotice | null;
  videoLayout: { width: number; height: number } | null;
  resolutionView: ResolutionView | null;
  extraNotice?: ReactNode;
  onExportVideo: (options: ExportVideoOptions) => Promise<void> | void;
  onExportSubtitles: (options: ExportSubtitlesOptions) => void;
  onAcceptFallback: () => void;
  onRejectFallback: () => void;
  onDismissNotice: () => void;
  onSelectOriginalVideo: (file: File) => void;
  onClose: () => void;
  userAgentInspector: UserAgentInspector;
}

type ExportKind = 'video' | 'subtitles';

type SettingsDefaults = Pick<ExportVideoOptions, 'format' | 'quality'>;
const DESKTOP_DEFAULTS: SettingsDefaults = { format: 'mp4', quality: 'high' };
const MOBILE_DEFAULTS: SettingsDefaults = { format: 'mp4', quality: 'medium' };

export function ExportDialog({
  open,
  phase,
  isExporting,
  error,
  fallbackWarning,
  notice,
  videoLayout,
  resolutionView,
  extraNotice,
  onExportVideo,
  onExportSubtitles,
  onAcceptFallback,
  onRejectFallback,
  onDismissNotice,
  onSelectOriginalVideo,
  onClose,
  userAgentInspector,
}: ExportDialogProps) {
  const [kind, setKind] = useState<ExportKind>('video');
  const [wasOpen, setWasOpen] = useState(open);

  // Video is where almost everyone is headed, so every visit starts
  // there however the last one ended. Adjusted while rendering rather
  // than from an effect so the reset costs no extra commit.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setKind('video');
    }
  }

  const defaults = userAgentInspector.isMobile() ? MOBILE_DEFAULTS : DESKTOP_DEFAULTS;
  const title = phase === 'error'              ? (error ? getAppErrorTitle(error) : 'Export failed')
              : phase === 'fallback-warning'   ? 'Slower export ahead'
              : phase === 'notice'             ? 'Export complete'
              : kind === 'subtitles'           ? 'Export subtitles'
              :                                  'Export video';
  const locked = isExporting || phase === 'fallback-warning' || phase === 'notice';

  const cloudProps = {};
  const exit = 'fade';
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      locked={locked}
      size="md"
      exit={exit}
      title={title}
      showCloseButton={phase === 'error'}
    >
      {phase === 'settings' && kind === 'subtitles' && (
        <SubtitleExportSettings
          onConfirm={onExportSubtitles}
          onSwitchToVideo={() => setKind('video')}
          onCancel={onClose}
        />
      )}
      {phase === 'settings' && kind === 'video' && videoLayout && resolutionView && (
        <VideoExportSettings
          defaults={defaults}
          {...cloudProps}
          resolutionView={resolutionView}
          extraNotice={extraNotice}
          onConfirm={onExportVideo}
          onSwitchToSubtitles={() => setKind('subtitles')}
          onCancel={onClose}
        />
      )}
      {phase === 'fallback-warning' && fallbackWarning && (
        <FallbackDecoderWarningView
          humanCodec={fallbackWarning.humanCodec}
          humanBrowser={fallbackWarning.humanBrowser}
          humanOs={fallbackWarning.humanOs}
          reEncodeTo={fallbackWarning.reEncodeTo}
          betterBrowser={fallbackWarning.betterBrowser}
          onContinue={onAcceptFallback}
          onCancel={onRejectFallback}
        />
      )}
      {phase === 'notice' && notice && (
        <ExportNoticeView notice={notice} onDismiss={onDismissNotice} />
      )}
      {phase === 'error' && error && (
        <>
          <div className="text-sm text-fg-secondary">
            <AppErrorMessage error={error} isMobile={userAgentInspector.isMobile()} />
          </div>
          {awaitsAnotherVideoFile(error) && (
            <AppDialogActions>
              <VideoFilePickerButton
                label="Select video"
                className={BTN_PRIMARY_SM}
                autoFocus
                onSelect={onSelectOriginalVideo}
              />
            </AppDialogActions>
          )}
        </>
      )}
    </AppDialog>
  );
}


// When a server holds the video, reloading brings it back and asking
// the reader for a file would be busywork.
function awaitsAnotherVideoFile(error: AppError): boolean {
  return error.name === 'OriginalVideoUnavailableError'
    && !(error as OriginalVideoUnavailableError).hasRemoteCopy;
}
