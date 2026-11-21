import { AppDialog } from '@ui/_shared/components/Dialog/AppDialog';
import { BTN_PRIMARY_SM } from '@ui/_shared/styles/buttons';

interface OutdatedPageDialogProps {
  open: boolean;
  /** Whether reloading now would lose work the reader could otherwise keep. */
  unsavedWork: boolean;
  onReload: () => void;
  onDismiss: () => void;
}

/**
 * Tells a reader that this tab runs an older version of tscaps than
 * the one already used in this browser, and offers the reload that
 * fixes it. The X leaves the tab as it is, for a reader who wants to
 * look at or copy something before reloading.
 */
export function OutdatedPageDialog({ open, unsavedWork, onReload, onDismiss }: OutdatedPageDialogProps) {
  const lead = useOutdatedPageLead();
  return (
    <AppDialog
      open={open}
      onClose={onDismiss}
      size="md"
      title="Tscaps was updated"
      description={unsavedWork ? `${lead} If you reload now, changes you did not save will be lost.` : lead}
      showCloseButton
    >
      <div className="flex items-center justify-end pt-1">
        <button type="button" className={BTN_PRIMARY_SM} onClick={onReload} autoFocus>
          Reload
        </button>
      </div>
    </AppDialog>
  );
}

/**
 * What the old version can no longer do depends on where projects are
 * kept. Projects kept in this browser stop saving. Projects kept on
 * the server still save, and only the parts of the editor that keep
 * files in the browser stop working.
 */
function useOutdatedPageLead(): string {
  return 'This tab still runs the previous version of tscaps, so it cannot save your projects anymore. Reload the tab to use the new version.';
}
