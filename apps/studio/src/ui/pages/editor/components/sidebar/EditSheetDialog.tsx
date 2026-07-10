import { useEffect, useRef, useState } from 'react';
import { AppDialog, AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';
import type { Sheet } from '@core/sheets/domain/Sheet';

export interface EditSheetDialogResult {
  readonly name: string;
}

interface EditSheetDialogProps {
  open: boolean;
  /** `null` puts the dialog in create mode (fresh name). */
  sheet: Sheet | null;
  onConfirm: (result: EditSheetDialogResult) => void;
  onCancel: () => void;
}

const SECTION_LABEL = 'block text-xs text-fg-secondary mb-1.5 tracking-[-0.005em]';
const INPUT =
  'w-full box-border bg-surface-1 border border-edge-medium rounded-xs text-fg-primary text-sm py-2 px-2.5 outline-none ' +
  'transition-colors duration-quick ease-standard placeholder:text-fg-faint ' +
  'hover:border-edge-strong ' +
  'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30';

export function EditSheetDialog({ open, sheet, onConfirm, onCancel }: EditSheetDialogProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-seed local state on open so the dialog reflects the latest sheet
  // even when reopened against the same instance after external edits.
  // Render-time sync avoids an extra effect tick.
  const [lastOpen, setLastOpen] = useState(open);
  const [lastSheet, setLastSheet] = useState(sheet);
  if (open !== lastOpen || sheet !== lastSheet) {
    setLastOpen(open);
    setLastSheet(sheet);
    if (open) setName(sheet === null ? 'New sheet' : sheet.name);
  }

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.select(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm({ name: trimmed });
  };

  const title = sheet === null ? 'New sheet' : `Edit ${sheet.name}`;
  const confirmLabel = sheet === null ? 'Create' : 'Save';

  return (
    <AppDialog open={open} onClose={onCancel} size="md" title={title}>
      <div>
        <label className={SECTION_LABEL} htmlFor="edit-sheet-name">Name</label>
        <input
          id="edit-sheet-name"
          ref={inputRef}
          className={INPUT}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
          autoFocus
        />
      </div>

      <AppDialogActions>
        <button type="button" className={BTN_SECONDARY_SM} onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className={BTN_PRIMARY_SM}
          onClick={handleConfirm}
          disabled={!name.trim()}
        >
          {confirmLabel}
        </button>
      </AppDialogActions>
    </AppDialog>
  );
}
