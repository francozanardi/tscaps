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
import { OtherExportFormats } from '@ui/pages/editor/features/export/components/OtherExportFormats';
import { CaptionsOnlyExportSettings } from '@ui/pages/editor/features/export/components/CaptionsOnlyExportSettings';
import { FallbackDecoderWarningView } from '@ui/pages/editor/features/export/components/FallbackDecoderWarningView';
import { FootageUnavailableWarningView } from '@ui/pages/editor/features/export/components/FootageUnavailableWarningView';
import { AudioUnavailableWarningView } from '@ui/pages/editor/features/export/components/AudioUnavailableWarningView';
import type { SoundtrackCodecs } from '@presentation/export/services/SoundtrackCodecAdvisor';
import { ExportNoticeView } from '@ui/pages/editor/features/export/components/ExportNoticeView';

export type ExportDialogPhase = 'settings' | 'fallback-warning' | 'footage-warning' | 'audio-warning' | 'error' | 'notice';

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
  /** The files an export would go without, while it asks whether to. */
  unavailableFootage: ReadonlyArray<string> | null;
  /** The sound files an export would go without, while it asks whether to. */
  unavailableAudio: ReadonlyArray<string> | null;
  /** How the project's sound effects and music would be saved per format; null when there are none, or not known yet. */
  soundtrackCodecs: SoundtrackCodecs | null;
  notice: ExportNotice | null;
  videoLayout: { width: number; height: number } | null;
  resolutionView: ResolutionView | null;
  /** Whether some caption style reads the video, so a captions-only export looks different. */
  captionsDependOnVideo: boolean;
  extraNotice?: ReactNode;
  onExportVideo: (options: ExportVideoOptions) => Promise<void> | void;
  onExportSubtitles: (options: ExportSubtitlesOptions) => void;
  onAcceptPause: () => void;
  onRejectPause: () => void;
  onDismissNotice: () => void;
  onSelectOriginalVideo: (file: File) => void;
  onClose: () => void;
  userAgentInspector: UserAgentInspector;
}

type ExportKind = 'video' | 'other' | 'subtitles' | 'captions-only';

type SettingsDefaults = Pick<ExportVideoOptions, 'format' | 'quality'>;
const DESKTOP_DEFAULTS: SettingsDefaults = { format: 'mp4', quality: 'high' };
const MOBILE_DEFAULTS: SettingsDefaults = { format: 'mp4', quality: 'medium' };

export function ExportDialog({
  open,
  phase,
  isExporting,
  error,
  fallbackWarning,
  unavailableFootage,
  unavailableAudio,
  soundtrackCodecs,
  notice,
  videoLayout,
  resolutionView,
  captionsDependOnVideo,
  extraNotice,
  onExportVideo,
  onExportSubtitles,
  onAcceptPause,
  onRejectPause,
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
              : phase === 'footage-warning'    ? 'Some clips are missing'
              : phase === 'audio-warning'      ? 'Export without these sounds?'
              : phase === 'notice'             ? 'Export complete'
              : kind === 'subtitles'           ? 'Export subtitles'
              : kind === 'other'               ? 'Export captions'
              : kind === 'captions-only'       ? 'Export captions as a video'
              :                                  'Export video';
  const locked = isExporting || phase === 'fallback-warning' || phase === 'footage-warning'
    || phase === 'audio-warning' || phase === 'notice';

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
      {phase === 'settings' && kind === 'other' && (
        <OtherExportFormats
          onChooseSubtitles={() => setKind('subtitles')}
          onChooseCaptionsOnly={() => setKind('captions-only')}
          onBackToVideo={() => setKind('video')}
          onCancel={onClose}
        />
      )}
      {phase === 'settings' && kind === 'captions-only' && videoLayout && resolutionView && (
        <CaptionsOnlyExportSettings
          defaults={defaults}
          resolutionView={resolutionView}
          dependsOnVideo={captionsDependOnVideo}
          soundtrackCodecs={soundtrackCodecs}
          extraNotice={extraNotice}
          onConfirm={onExportVideo}
          onBack={() => setKind('other')}
          onCancel={onClose}
        />
      )}
      {phase === 'settings' && kind === 'video' && videoLayout && resolutionView && (
        <VideoExportSettings
          defaults={defaults}
          {...cloudProps}
          resolutionView={resolutionView}
          soundtrackCodecs={soundtrackCodecs}
          extraNotice={extraNotice}
          onConfirm={onExportVideo}
          onSwitchToOtherFormats={() => setKind('other')}
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
          onContinue={onAcceptPause}
          onCancel={onRejectPause}
        />
      )}
      {phase === 'footage-warning' && unavailableFootage && (
        <FootageUnavailableWarningView
          fileNames={unavailableFootage}
          onContinue={onAcceptPause}
          onCancel={onRejectPause}
        />
      )}
      {phase === 'audio-warning' && unavailableAudio && (
        <AudioUnavailableWarningView
          fileNames={unavailableAudio}
          onContinue={onAcceptPause}
          onCancel={onRejectPause}
        />
      )}
      {phase === 'notice' && notice && (
        <ExportNoticeView notice={notice} isMobile={userAgentInspector.isMobile()} onDismiss={onDismissNotice} />
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
