import { AsyncButton } from '@ui/_shared/components/AsyncButton/AsyncButton';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';

interface ExportSettingsFooterProps {
  /** Wording for the quiet link that leads to the other kind of export. */
  alternateLabel: string;
  confirmLabel: string;
  confirmDisabled?: boolean | undefined;
  /** Draws a spinner in the confirm button while it is working. */
  confirmShowsPending?: boolean | undefined;
  onAlternate: () => void;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

const ALTERNATE_LINK =
  'text-xs text-fg-faint hover:text-fg-secondary underline underline-offset-2 decoration-edge-medium ' +
  'hover:decoration-edge-strong transition-colors duration-quick ease-standard cursor-pointer ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-xs';

/**
 * Closing row of a settings view: the way out to the other kind of
 * export on the left, the decision buttons on the right.
 *
 * The alternate export sits here, quiet and off to the side, because it
 * is the rarer errand. Giving it a peer's weight at the top of the
 * dialog would tax everyone who came for the common one.
 */
export function ExportSettingsFooter({
  alternateLabel,
  confirmLabel,
  confirmDisabled,
  confirmShowsPending,
  onAlternate,
  onCancel,
  onConfirm,
}: ExportSettingsFooterProps) {
  return (
    <div className="flex items-center gap-4 pt-4 border-t border-edge-subtle">
      <button type="button" className={ALTERNATE_LINK} onClick={onAlternate}>
        {alternateLabel}
      </button>
      <div className="flex gap-2 ml-auto">
        <button type="button" className={BTN_SECONDARY_SM} onClick={onCancel}>Cancel</button>
        <AsyncButton
          className={BTN_PRIMARY_SM}
          onClick={onConfirm}
          disabled={confirmDisabled ?? false}
          showPending={confirmShowsPending ?? false}
          autoFocus
        >
          {confirmLabel}
        </AsyncButton>
      </div>
    </div>
  );
}
