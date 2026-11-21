import type { ReactElement } from 'react';
import { AlertCircle } from 'lucide-react';
import type { OriginalVideoUnavailableError } from '@core/videos/domain/errors/OriginalVideoUnavailableError';
import { AppErrorMessage, getAppErrorTitle } from '@ui/_shared/components/AppErrorMessage/AppErrorMessage';
import { VideoFilePickerButton } from '@ui/_shared/components/VideoFilePickerButton';
import { BTN_PRIMARY_SM } from '@ui/_shared/styles/buttons';

interface PreviewSourceUnavailablePanelProps {
  readonly error: OriginalVideoUnavailableError;
  readonly onSelectOriginalVideo: (file: File) => void;
}

/**
 * Covers the preview when its video stopped reading and no other copy
 * could take its place: what happened, and the way back. The way back
 * is choosing the file again, unless a server holds the video, where
 * the copy says to reload instead.
 */
export function PreviewSourceUnavailablePanel({ error, onSelectOriginalVideo }: PreviewSourceUnavailablePanelProps): ReactElement {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-surface-1 p-4"
      role="alert"
      data-testid="preview-source-unavailable"
    >
      <AlertCircle size={32} className="shrink-0 text-fg-faint" />
      <p className="m-0 text-center text-sm font-medium text-fg-primary">{getAppErrorTitle(error)}</p>
      <div className="max-w-sm text-xs text-fg-secondary">
        <AppErrorMessage error={error} />
      </div>
      {!error.hasRemoteCopy && (
        <VideoFilePickerButton label="Select video" className={BTN_PRIMARY_SM} onSelect={onSelectOriginalVideo} />
      )}
    </div>
  );
}
