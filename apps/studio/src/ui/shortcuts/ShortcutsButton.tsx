import { Keyboard } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { useShortcutsDialogStore } from '@ui/_shared/contexts/ShortcutsDialogContext';
import { useShortcutLabel } from '@ui/_shared/hooks/useShortcutLabel';

const BTN_CLASS =
  'inline-flex items-center justify-center w-8 h-8 bg-transparent border border-transparent rounded-xs text-fg-secondary ' +
  'cursor-pointer transition-colors duration-quick ease-standard ' +
  'hover:bg-surface-2 hover:border-edge-medium hover:text-fg-primary ' +
  'focus-visible:outline-none focus-visible:border-accent';

/** Toolbar button that opens the keyboard shortcuts dialog. */
export function ShortcutsButton() {
  const dialogStore = useShortcutsDialogStore();
  const shortcutLabel = useShortcutLabel('app.showShortcuts');
  const tooltip = shortcutLabel ? `Keyboard shortcuts (${shortcutLabel})` : 'Keyboard shortcuts';
  return (
    <Tooltip text={tooltip} position="bottom">
      <button
        type="button"
        className={BTN_CLASS}
        onClick={() => dialogStore.setOpen(true)}
        aria-label="Keyboard shortcuts"
      >
        <Keyboard size={16} />
      </button>
    </Tooltip>
  );
}
