import { Search } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

const ICON_BTN =
  'inline-flex items-center justify-center w-7 h-7 rounded-xs bg-transparent border-none cursor-pointer ' +
  'text-fg-secondary hover:text-fg-primary hover:bg-surface-2 ' +
  'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-2 ' +
  'disabled:text-fg-faint disabled:hover:bg-transparent disabled:cursor-not-allowed';

const ICON_BTN_ACTIVE =
  'inline-flex items-center justify-center w-7 h-7 rounded-xs bg-surface-3 border-none cursor-pointer ' +
  'text-fg-primary transition-colors duration-quick ease-standard focus-visible:outline-none';

interface SearchToggleButtonProps {
  open: boolean;
  shortcutLabel?: string;
  onToggle: () => void;
}

/**
 * Toolbar affordance that opens or closes the panel's search bar.
 * The button styles itself as active while the bar is open. The
 * `shortcutLabel`, if provided, is appended to the open-state tooltip
 * in parentheses.
 */
export function SearchToggleButton({ open, shortcutLabel, onToggle }: SearchToggleButtonProps) {
  const closedTooltip = shortcutLabel ? `Search scenes (${shortcutLabel})` : 'Search scenes';
  const tooltip = open ? 'Close search' : closedTooltip;
  return (
    <Tooltip text={tooltip} position="bottom">
      <button
        type="button"
        className={open ? ICON_BTN_ACTIVE : ICON_BTN}
        onClick={onToggle}
        aria-label={open ? 'Close search' : 'Search scenes'}
      >
        <Search size={14} />
      </button>
    </Tooltip>
  );
}
