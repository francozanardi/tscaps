import { useEffect, useMemo, useRef, useState } from 'react';
import { AppDialog, AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';

interface PromptDialogProps {
  open: boolean;
  label: string;
  defaultValue?: string;
  confirmLabel?: string;
  /**
   * Live validator. Returns a user-facing error message when `raw`
   * cannot be confirmed, `null` when it can. When omitted, the dialog
   * accepts any non-empty trimmed value.
   */
  validate?: (raw: string) => string | null;
  /**
   * Optional cap surfaced as a `12/24` counter beside the input. Cosmetic —
   * the dialog does not enforce it; that is the validator's job.
   */
  maxLength?: number;
  /**
   * External async error to surface under the input (e.g. an action
   * that failed after the dialog passed local validation). Independent
   * of `validate` so the dialog can stay open after a failed submit.
   */
  errorMessage?: string | null;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

const INPUT_LABEL = 'block text-xs text-fg-secondary tracking-[-0.005em]';
const INPUT =
  'w-full box-border bg-surface-1 border border-edge-medium rounded-xs text-fg-primary text-sm py-2 px-2.5 outline-none ' +
  'transition-colors duration-quick ease-standard placeholder:text-fg-faint ' +
  'hover:border-edge-strong ' +
  'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30';
const INPUT_INVALID =
  'w-full box-border bg-surface-1 border border-danger rounded-xs text-fg-primary text-sm py-2 px-2.5 outline-none ' +
  'transition-colors duration-quick ease-standard placeholder:text-fg-faint ' +
  'focus-visible:ring-2 focus-visible:ring-danger/30';

export function PromptDialog({
  open,
  label,
  defaultValue = '',
  confirmLabel = 'Create',
  validate,
  maxLength,
  errorMessage = null,
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-seed the draft each time the dialog opens (or the suggestion changes
  // while open) — render-time sync avoids an extra effect tick.
  const [lastOpen, setLastOpen] = useState(open);
  const [lastDefaultValue, setLastDefaultValue] = useState(defaultValue);
  if (open !== lastOpen || defaultValue !== lastDefaultValue) {
    setLastOpen(open);
    setLastDefaultValue(defaultValue);
    if (open) setValue(defaultValue);
  }

  // On the same render that mounts the input, ask Radix's focus-on-mount to
  // land on it (autoFocus) and then select the contents so the user can type
  // over the suggestion.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.select(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const trimmed = value.trim();
  const localError = useMemo(() => {
    if (!validate) return null;
    return validate(trimmed);
  }, [validate, trimmed]);

  // Hide the "required" flash while the field is empty — the disabled
  // confirm already conveys that state, and the message reads as noisy
  // on first open.
  const visibleError = trimmed.length === 0 ? errorMessage : (localError ?? errorMessage);
  const canConfirm = trimmed.length > 0 && localError === null;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(trimmed);
  };

  const inputClass = visibleError ? INPUT_INVALID : INPUT;
  const counter = maxLength !== undefined ? `${value.length}/${maxLength}` : null;

  return (
    <AppDialog open={open} onClose={onCancel} size="sm" title={label} titleSrOnly>
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <label className={INPUT_LABEL} htmlFor="prompt-input">{label}</label>
          {counter && (
            <span className="text-2xs text-fg-faint font-mono tabular-nums">{counter}</span>
          )}
        </div>
        <input
          id="prompt-input"
          ref={inputRef}
          className={inputClass}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
          aria-invalid={visibleError ? true : undefined}
          aria-describedby={visibleError ? 'prompt-error' : undefined}
          autoFocus
        />
        {visibleError && (
          <p id="prompt-error" className="mt-1.5 text-2xs text-danger">{visibleError}</p>
        )}
      </div>
      <AppDialogActions>
        <button type="button" className={BTN_SECONDARY_SM} onClick={onCancel}>Cancel</button>
        <button type="button" className={BTN_PRIMARY_SM} onClick={handleConfirm} disabled={!canConfirm}>
          {confirmLabel}
        </button>
      </AppDialogActions>
    </AppDialog>
  );
}
