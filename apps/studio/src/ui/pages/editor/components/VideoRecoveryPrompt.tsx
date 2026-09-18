import { AlertTriangle } from 'lucide-react';
import type { AppError } from '@core/errors/domain/AppError';
import type { VideoBlobMissReason } from '@core/videos/domain/VideoBlobLookup';
import { AppDialog, AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { getAppErrorTitle, useAppErrorShortDescription, useEngineFallbackBullets } from '@ui/_shared/components/AppErrorMessage/AppErrorMessage';
import { useUtils } from '@ui/_shared/contexts/modules/UtilsContext';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';
import { VideoFilePickerButton } from '@ui/_shared/components/VideoFilePickerButton';

interface VideoRecoveryPromptProps {
  projectName: string;
  videoFileName: string;
  /** Why the bytes were found nowhere; picks the explanation. */
  reason: VideoBlobMissReason;
  /** What went wrong with the file chosen last, if one was chosen and rejected. */
  error: AppError | null;
  recovering?: boolean;
  onSelect: (file: File) => void;
  onCancel: () => void;
}

/**
 * Shown after LoadProjectAction succeeds but the project's video bytes
 * were found nowhere. Names the original file so the user can
 * recognise which one to re-pick. Cancel returns to the dashboard.
 *
 * The explanation follows the reason: an entry this app evicted to
 * make room is its own doing and says so, while bytes the browser
 * took away are the platform's, and those two cases also carry the
 * advice about browsers and devices that the rest of the catalog
 * gives, since the platform is the thing to change.
 *
 * Stays open when a chosen file is refused, with the reason above the
 * picker: the answer to most of those failures is another file.
 */
export function VideoRecoveryPrompt({
  projectName,
  videoFileName,
  reason,
  error,
  recovering = false,
  onSelect,
  onCancel,
}: VideoRecoveryPromptProps) {
  const isMobile = useUtils().userAgentInspector.isMobile();
  const platformBullets = useEngineFallbackBullets(isMobile);
  const browserTookTheBytes = reason === 'stored-bytes-gone' || reason === 'held-file-gone';

  return (
    <AppDialog
      open
      onClose={onCancel}
      locked={recovering}
      size="md"
      title={projectName}
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm text-fg-secondary leading-normal m-0">{explain(reason)}</p>
        <p className="text-sm text-fg-secondary leading-normal m-0">
          Re-select <strong className="text-fg-primary">{videoFileName}</strong> to keep editing — your
          captions and styles are intact.
        </p>
        {browserTookTheBytes && platformBullets.length > 0 && (
          <ul className="text-sm text-fg-secondary leading-normal m-0 pl-5">
            {platformBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
          </ul>
        )}
        {error && <RejectedFileNotice error={error} />}
      </div>
      <AppDialogActions>
        <button
          type="button"
          className={BTN_SECONDARY_SM}
          onClick={onCancel}
          disabled={recovering}
        >
          Back to dashboard
        </button>
        <VideoFilePickerButton
          label={recovering ? 'Recovering…' : 'Re-select video'}
          className={BTN_PRIMARY_SM}
          autoFocus
          disabled={recovering}
          loading={recovering}
          onSelect={onSelect}
        />
      </AppDialogActions>
    </AppDialog>
  );
}

function explain(reason: VideoBlobMissReason): string {
  switch (reason) {
    case 'absent':
      return "The source video was removed from this browser's cache (only the last few projects keep their video on hand).";
    case 'stored-bytes-gone':
      return 'Your browser removed the stored video of this project. Some browsers clear stored data on their own.';
    case 'held-file-gone':
      return 'The browser can no longer read the video file you chose. On iPhone and iPad, the system removes chosen files after a while.';
    case 'remote-provider-unresponsive':
      return "The video is on our servers, but they aren't responding right now. Try again in a few minutes, or upload the file again from this device.";
    case 'remote-provider-absent':
      return "We couldn't find the video in our servers. Try again in a few minutes, or upload the file again from this device.";
  }
}

function RejectedFileNotice({ error }: { readonly error: AppError }) {
  const description = useAppErrorShortDescription(error);
  return (
    <div
      role="alert"
      className="mt-1 flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2"
    >
      <AlertTriangle size={16} strokeWidth={2.5} className="text-danger shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-sm text-fg-secondary leading-normal m-0">
        <span className="text-fg-primary">{getAppErrorTitle(error)}.</span> {description}
      </p>
    </div>
  );
}
