import { LocateFixed } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

const ICON_BTN =
  'inline-flex items-center justify-center w-7 h-7 rounded-xs bg-transparent border-none cursor-pointer ' +
  'text-fg-secondary hover:text-fg-primary hover:bg-surface-2 ' +
  'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-2 ' +
  'disabled:text-fg-faint disabled:hover:bg-transparent disabled:cursor-not-allowed';

interface LocateButtonProps {
  disabled: boolean;
  shortcutLabel?: string;
  onLocate: () => void;
}

/**
 * Toolbar affordance that scrolls the panel to the playhead-active
 * segment. Disabled when no segment is currently active. The
 * `shortcutLabel`, if provided, is appended to the tooltip in
 * parentheses.
 */
export function LocateButton({ disabled, shortcutLabel, onLocate }: LocateButtonProps) {
  const tooltip = shortcutLabel ? `Go to current scene (${shortcutLabel})` : 'Go to current scene';
  return (
    <Tooltip text={tooltip} position="bottom">
      <button
        type="button"
        className={ICON_BTN}
        onClick={onLocate}
        disabled={disabled}
        aria-label="Go to current scene"
      >
        <LocateFixed size={14} />
      </button>
    </Tooltip>
  );
}
