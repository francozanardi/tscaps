import { AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { ErrorBody, useEngineFallbackBullets } from '@ui/_shared/components/AppErrorMessage/AppErrorMessage';
import { BTN_PRIMARY_SM } from '@ui/_shared/styles/buttons';
import type { ExportNotice } from '@core/export/domain/ExportNotice';
import { ExportNoticeCopy } from '@presentation/export/services/ExportNoticeCopy';

interface ExportNoticeViewProps {
  notice: ExportNotice;
  isMobile: boolean;
  onDismiss: () => void;
}

const COPY = new ExportNoticeCopy();

/**
 * The body of the dialog after an export that finished with something
 * missing from the file: what is missing and why, then what to try, laid
 * out as an engine failure's remedies are. The browser hints are the
 * ones every engine failure gives: a Chromium-based browser only when
 * this one is not, a desktop browser only on a phone.
 */
export function ExportNoticeView({ notice, isMobile, onDismiss }: ExportNoticeViewProps) {
  const text = COPY.textOf(notice);
  const fallbackBullets = useEngineFallbackBullets(isMobile);
  return (
    <div className="flex flex-col gap-4 text-sm">
      <ErrorBody lead={text.lead} bullets={[...(text.formatRemedy === null ? [] : [text.formatRemedy]), ...fallbackBullets]} />
      <AppDialogActions>
        <button type="button" className={BTN_PRIMARY_SM} onClick={onDismiss} autoFocus>
          Got it
        </button>
      </AppDialogActions>
    </div>
  );
}
