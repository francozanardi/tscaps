import type { ReactNode } from 'react';
import '@ui/pages/editor/features/transcript/components/bulk-mode/BulkModeBottomBar.css';

interface BulkModeBottomBarProps {
  target: 'scenes' | 'words';
  selectionCount: number;
  allSelected: boolean;
  actions: ReactNode;
  onToggleAll: () => void;
  onClear: () => void;
  onDone: () => void;
}

const SECONDARY_BUTTON =
  'inline-flex items-center h-8 px-2 rounded-xs text-2xs bg-transparent border-none cursor-pointer whitespace-nowrap ' +
  'text-fg-secondary hover:text-fg-primary hover:bg-surface-3 ' +
  'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-3';

/** Sticky selection summary and command surface for transcript bulk mode. */
export function BulkModeBottomBar({
  target,
  selectionCount,
  allSelected,
  actions,
  onToggleAll,
  onClear,
  onDone,
}: BulkModeBottomBarProps) {
  const noun = target === 'scenes' ? 'scene' : 'word';
  return (
    <div className="bulk-mode-bottom-bar sticky bottom-0 z-20 bg-surface-2 border-t border-edge-medium shadow-[0_-6px_10px_-8px_rgba(0,0,0,0.35)] mt-2">
      <div className="flex items-stretch">
        <span className="w-[4px] shrink-0 bg-accent" aria-hidden />
        <div className="bulk-mode-bottom-bar__content flex items-center gap-0.5 px-2 py-2 flex-1 min-w-0">
          <span className="bulk-mode-bottom-bar__summary text-2xs font-mono tabular-nums text-fg-secondary flex-1 min-w-0 truncate">
            {selectionCount} {selectionCount === 1 ? noun : `${noun}s`}
          </span>
          <div className="bulk-mode-bottom-bar__selection flex items-center gap-0.5 shrink-0">
            <button type="button" className={SECONDARY_BUTTON} onClick={onToggleAll}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
            {selectionCount > 0 && !allSelected && (
              <button type="button" className={SECONDARY_BUTTON} onClick={onClear}>Clear</button>
            )}
          </div>
          <div className="bulk-mode-bottom-bar__completion flex items-center gap-1 shrink-0">
            <button type="button" className={SECONDARY_BUTTON} onClick={onDone}>Done</button>
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
}
