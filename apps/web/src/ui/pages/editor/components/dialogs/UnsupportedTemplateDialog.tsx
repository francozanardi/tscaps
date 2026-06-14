import { AppDialog, AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { BTN_PRIMARY_SM } from '@ui/_shared/styles/buttons';

interface UnsupportedTemplateDialogProps {
  open: boolean;
  templateIds: ReadonlyArray<string>;
  onDismiss: () => void;
}

/**
 * Dialog that names one or more template ids the current browser
 * cannot render. `onDismiss` fires when the user acknowledges the
 * message.
 */
export function UnsupportedTemplateDialog({ open, templateIds, onDismiss }: UnsupportedTemplateDialogProps) {
  const plural = templateIds.length !== 1;
  return (
    <AppDialog
      open={open}
      onClose={onDismiss}
      size="md"
      title="This project uses a template your browser can't render"
      description={
        `The following template${plural ? 's' : ''} won't display correctly here: ` +
        `${templateIds.join(', ')}. Open the project in a Chromium-based browser ` +
        '(Chrome, Edge, Brave, Arc) to keep editing it.'
      }
    >
      <AppDialogActions>
        <button type="button" className={BTN_PRIMARY_SM} onClick={onDismiss} autoFocus>
          Back to dashboard
        </button>
      </AppDialogActions>
    </AppDialog>
  );
}
