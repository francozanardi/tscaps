import { LocateFixed } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

const ICON_BTN =
  'inline-flex items-center justify-center w-7 h-7 rounded-xs bg-transparent border-none cursor-pointer ' +
  'text-fg-secondary hover:text-fg-primary hover:bg-surface-2 ' +
  'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-2 ' +
  'disabled:text-fg-faint disabled:hover:bg-transparent disabled:cursor-not-allowed';

interface LocateButtonProps {
  disabled: boolean;
  shortcutLabel?: string | null;
  onLocate: () => void;
  /** What the playhead is inside, as the tooltip names it. Defaults to a scene. */
  targetLabel?: string;
}

/**
 * Toolbar affordance that scrolls the panel to the item under the
 * playhead. Disabled when no segment is currently active. The
 * `shortcutLabel`, if provided, is appended to the tooltip in
 * parentheses.
 */
export function LocateButton({ disabled, shortcutLabel, onLocate, targetLabel = 'scene' }: LocateButtonProps) {
  const label = `Go to current ${targetLabel}`;
  const tooltip = shortcutLabel ? `${label} (${shortcutLabel})` : label;
  return (
    <Tooltip text={tooltip} position="bottom">
      <button
        type="button"
        className={ICON_BTN}
        onClick={onLocate}
        disabled={disabled}
        aria-label={label}
      >
        <LocateFixed size={14} />
      </button>
    </Tooltip>
  );
}
