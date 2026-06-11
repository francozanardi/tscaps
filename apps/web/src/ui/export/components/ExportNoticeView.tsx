import { AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { BTN_PRIMARY_SM } from '@ui/_shared/styles/buttons';
import type { ExportNotice } from '@core/export/domain/ExportNotice';

interface ExportNoticeViewProps {
  notice: ExportNotice;
  onDismiss: () => void;
}

export function ExportNoticeView({ notice, onDismiss }: ExportNoticeViewProps) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p>{messageFor(notice)}</p>
      <AppDialogActions>
        <button type="button" className={BTN_PRIMARY_SM} onClick={onDismiss} autoFocus>
          Got it
        </button>
      </AppDialogActions>
    </div>
  );
}

function messageFor(notice: ExportNotice): string {
  switch (notice.kind) {
    case 'audio-discarded':
      return notice.reason === 'unknown-source-codec'
        ? "Your export is ready, but the source's audio track was dropped because we couldn't identify its codec. The exported file has no audio."
        : "Your export is ready, but the source's audio could not be re-encoded for this output format. Export to MP4 instead, or convert the source audio first to keep the sound.";
  }
}
