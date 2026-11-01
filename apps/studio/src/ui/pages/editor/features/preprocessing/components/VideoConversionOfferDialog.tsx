import type { VideoConversionOffer } from '@core/preprocessing/domain/VideoConversionOffer';
import { AppDialog, AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { StatusPill } from '@ui/_shared/components/StatusPill/StatusPill';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';

interface VideoConversionOfferDialogProps {
  readonly offer: VideoConversionOffer;
  readonly onAccept: () => void;
  readonly onDecline: () => void;
}

/**
 * Asks before converting a video this browser cannot read, and says
 * the conversion is experimental and how long it should take. Closing
 * the dialog declines; a click outside it does not, so a stray click
 * does not end the run.
 */
export function VideoConversionOfferDialog({ offer, onAccept, onDecline }: VideoConversionOfferDialogProps) {
  return (
    <AppDialog
      open
      onClose={onDecline}
      closeOnOutsideClick={false}
      size="md"
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          Convert this video?
          <StatusPill label="Experimental" tone="warning" />
        </span>
      }
      description="This browser cannot read the format of this video. Tscaps can convert it into a format this browser reads. The conversion runs on your device."
    >
      <div className="flex flex-col gap-2 text-sm text-fg-secondary">
        <p className="m-0">{durationSentence(offer.estimatedSeconds)} Keep this tab open until it finishes.</p>
        <p className="m-0">This is a new feature and can fail on some videos.</p>
      </div>
      <AppDialogActions>
        <button type="button" className={BTN_SECONDARY_SM} onClick={onDecline}>
          Cancel
        </button>
        <button type="button" className={BTN_PRIMARY_SM} onClick={onAccept} autoFocus>
          Convert video
        </button>
      </AppDialogActions>
    </AppDialog>
  );
}

function durationSentence(estimatedSeconds: number | null): string {
  if (estimatedSeconds === null) return 'A long video can take several minutes to convert.';
  if (estimatedSeconds < 60) return 'The conversion should take less than a minute.';
  const minutes = Math.ceil(estimatedSeconds / 60);
  return `The conversion should take about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`;
}
