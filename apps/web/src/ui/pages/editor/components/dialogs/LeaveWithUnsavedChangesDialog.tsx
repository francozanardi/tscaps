import { AppDialog } from '@ui/_shared/components/Dialog/AppDialog';
import { BTN_PRIMARY_SM, BTN_DANGER_SM } from '@ui/_shared/styles/buttons';

interface LeaveWithUnsavedChangesDialogProps {
  open: boolean;
  saving: boolean;
  onCancel: () => void;
  onLeaveWithoutSaving: () => void;
  onSaveAndLeave: () => void;
}

/**
 * Shown when the user attempts to leave the editor with unsaved
 * changes. The destructive "leave without saving" path sits on the
 * left, the recommended "save and leave" path on the right; the X
 * in the corner lets the user dismiss the dialog and stay in the
 * editor. The `saving` flag locks every action surface while the
 * in-flight save completes.
 */
export function LeaveWithUnsavedChangesDialog({
  open,
  saving,
  onCancel,
  onLeaveWithoutSaving,
  onSaveAndLeave,
}: LeaveWithUnsavedChangesDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onCancel}
      locked={saving}
      size="md"
      title="Unsaved changes"
      description="You have edits that have not been saved. If you leave now, they will be lost."
      showCloseButton
    >
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          className={`${BTN_DANGER_SM}`}
          onClick={onLeaveWithoutSaving}
          disabled={saving}
        >
          Leave without saving
        </button>
        <button
          type="button"
          className={`${BTN_PRIMARY_SM}`}
          onClick={onSaveAndLeave}
          disabled={saving}
          autoFocus
        >
          {saving ? 'Saving…' : 'Save and leave'}
        </button>
      </div>
    </AppDialog>
  );
}
