import { Scissors, X } from 'lucide-react';
import type { CutsSelection } from '@presentation/cuts/controllers/CutsEditingController';

const HEADER_BUTTON_CLASS =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-xs border border-edge-medium bg-surface-3 ' +
  'text-2xs font-medium font-sans normal-case tracking-normal text-fg-primary ' +
  'cursor-pointer transition-colors duration-quick ease-standard ' +
  'enabled:hover:bg-surface-2 enabled:hover:border-accent ' +
  'focus-visible:outline-none focus-visible:border-accent';

const HEADER_DANGER_BUTTON_CLASS =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-xs border border-danger/40 bg-danger/15 ' +
  'text-2xs font-medium font-sans normal-case tracking-normal text-danger ' +
  'cursor-pointer transition-colors duration-quick ease-standard ' +
  'enabled:hover:bg-danger/25 enabled:hover:border-danger ' +
  'focus-visible:outline-none focus-visible:border-danger';

interface SelectionActionsProps {
  selection: CutsSelection;
  onCut: () => void;
  onCancel: () => void;
}

/**
 * Header bar shown above a segment's timeline while a drag-selection
 * is live. Displays the selection length and offers cancel and cut
 * affordances.
 */
export function SelectionActions({ selection, onCut, onCancel }: SelectionActionsProps) {
  const duration = selection.endSec - selection.startSec;
  return (
    <div className="flex items-center gap-1.5 w-full">
      <span className="text-fg-muted">Selection {duration.toFixed(2)}s</span>
      <div className="flex-1" />
      <button type="button" className={HEADER_BUTTON_CLASS} onClick={onCancel}>
        <X size={12} />
        <span>Cancel</span>
      </button>
      <button type="button" className={HEADER_DANGER_BUTTON_CLASS} onClick={onCut}>
        <Scissors size={12} />
        <span>Cut</span>
      </button>
    </div>
  );
}
