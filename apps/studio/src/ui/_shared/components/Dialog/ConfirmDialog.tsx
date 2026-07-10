import { Loader2 } from 'lucide-react';
import { AppDialog, AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM, BTN_DANGER_SM } from '@ui/_shared/styles/buttons';

interface ConfirmDialogProps {
  open: boolean;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  /** When true, both buttons are disabled and the confirm button shows a spinner. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onCancel}
      size="sm"
      title="Confirm"
      titleSrOnly
      description={message}
    >
      <AppDialogActions>
        <button type="button" className={BTN_SECONDARY_SM} onClick={onCancel} disabled={loading}>Cancel</button>
        <button
          type="button"
          className={danger ? BTN_DANGER_SM : BTN_PRIMARY_SM}
          onClick={onConfirm}
          autoFocus
          disabled={loading}
        >
          {loading && <Loader2 size={12} className="animate-spin" />}
          {confirmLabel}
        </button>
      </AppDialogActions>
    </AppDialog>
  );
}
