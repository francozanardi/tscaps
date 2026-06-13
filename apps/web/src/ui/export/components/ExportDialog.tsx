import type { ReactNode } from 'react';
import type { ExportVideoOptions } from '@core/export/actions/ExportVideoAction';
import type { ExportNotice } from '@core/export/domain/ExportNotice';
import type { UserAgentInspector } from '@core/_shared/UserAgentInspector';
import type { AppError } from '@core/_shared/domain/AppError';
import { AppDialog, AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { AppErrorMessage, getAppErrorTitle } from '@ui/_shared/components/AppErrorMessage/AppErrorMessage';
import { BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';
import { ExportSettingsForm, type ResolutionView } from '@ui/export/components/ExportSettingsForm';
import { FallbackDecoderWarningView } from '@ui/export/components/FallbackDecoderWarningView';
import { ExportNoticeView } from '@ui/export/components/ExportNoticeView';

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
  onConfirm: (options: ExportVideoOptions) => void;
  onAcceptFallback: () => void;
  onRejectFallback: () => void;
  onDismissNotice: () => void;
  onClose: () => void;
  userAgentInspector: UserAgentInspector;
}

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
  onConfirm,
  onAcceptFallback,
  onRejectFallback,
  onDismissNotice,
  onClose,
  userAgentInspector,
}: ExportDialogProps) {
  const defaults = userAgentInspector.isMobile() ? MOBILE_DEFAULTS : DESKTOP_DEFAULTS;
  const title = phase === 'error'              ? (error ? getAppErrorTitle(error) : 'Export failed')
              : phase === 'fallback-warning'   ? 'Slower export ahead'
              : phase === 'notice'             ? 'Export complete'
              :                                  'Export video';
  const locked = isExporting || phase === 'fallback-warning' || phase === 'notice';

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      locked={locked}
      size="md"
      title={title}
    >
      {phase === 'settings' && videoLayout && resolutionView && (
        <ExportSettingsForm
          defaults={defaults}
          resolutionView={resolutionView}
          extraNotice={extraNotice}
          onConfirm={onConfirm}
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
          <AppDialogActions>
            <button type="button" className={BTN_SECONDARY_SM} onClick={onClose} autoFocus>
              Close
            </button>
          </AppDialogActions>
        </>
      )}
    </AppDialog>
  );
}
