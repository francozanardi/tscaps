import { AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';

interface FallbackDecoderWarningViewProps {
  humanCodec: string;
  humanBrowser: string;
  humanOs: string;
  reEncodeTo: { format: string; codec: string };
  betterBrowser: string | null;
  onContinue: () => void;
  onCancel: () => void;
}

export function FallbackDecoderWarningView({
  humanCodec,
  humanBrowser,
  humanOs,
  reEncodeTo,
  betterBrowser,
  onContinue,
  onCancel,
}: FallbackDecoderWarningViewProps) {
  const reEncodeLabel = `${reEncodeTo.format} (${reEncodeTo.codec})`;
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p>
        Your video uses <span className="font-medium">{humanCodec}</span>. {humanBrowser} on {humanOs}
        {' '}cannot decode it through the fast path, so this export will fall back to a slower method
        that uses more memory and can take several times longer.
      </p>
      <p>For a faster export, you have two options:</p>
      <ul className="list-disc list-inside space-y-1 pl-1">
        <li>
          Convert your video to <span className="font-medium">{reEncodeLabel}</span> and import the new
          file.
        </li>
        {betterBrowser && (
          <li>
            Open this app in <span className="font-medium">{betterBrowser}</span>, which can decode
            this codec natively on {humanOs}.
          </li>
        )}
      </ul>
      <p className="text-fg-secondary">
        Your edits live in this browser, so switching browsers means importing the project on the
        other one.
      </p>
      <AppDialogActions>
        <button type="button" className={BTN_SECONDARY_SM} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={BTN_PRIMARY_SM} onClick={onContinue} autoFocus>
          Continue anyway
        </button>
      </AppDialogActions>
    </div>
  );
}
