import { RotateCcw } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

const ICON_BTN =
  'inline-flex items-center justify-center w-7 h-7 rounded-xs bg-transparent border-none cursor-pointer ' +
  'text-fg-secondary hover:text-fg-primary hover:bg-surface-2 ' +
  'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-2 ' +
  'disabled:text-fg-faint disabled:hover:bg-transparent disabled:cursor-not-allowed';

interface ClearAllCutsButtonProps {
  disabled: boolean;
  onClear: () => void;
}

/**
 * Toolbar affordance that removes every cut on the active video.
 * Disabled when no cuts exist.
 */
export function ClearAllCutsButton({ disabled, onClear }: ClearAllCutsButtonProps) {
  return (
    <Tooltip text="Restore all cuts" position="bottom">
      <button
        type="button"
        className={ICON_BTN}
        onClick={onClear}
        disabled={disabled}
        aria-label="Restore all cuts"
      >
        <RotateCcw size={14} />
      </button>
    </Tooltip>
  );
}
