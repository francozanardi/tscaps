import { forwardRef } from 'react';
import { X } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

interface BulkModeHeaderProps {
  target: 'scenes' | 'words';
  onClose: () => void;
}

const CLOSE_BUTTON =
  'inline-flex items-center justify-center w-7 h-7 rounded-xs bg-transparent border-none cursor-pointer ' +
  'text-fg-faint hover:text-fg-secondary hover:bg-surface-2 ' +
  'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-2';

/** Sticky transcript chrome that makes multi-selection a distinct temporary mode. */
export const BulkModeHeader = forwardRef<HTMLDivElement, BulkModeHeaderProps>(function BulkModeHeader({ target, onClose }, ref) {
  const noun = target === 'scenes' ? 'scenes' : 'words';
  return (
    <div ref={ref} className="sticky top-0 z-20 bg-surface-2 border-b border-edge-medium shadow-[0_6px_10px_-8px_rgba(0,0,0,0.35)]">
      <div className="flex items-stretch">
        <span className="w-[4px] shrink-0 bg-accent" aria-hidden />
        <div className="flex items-center justify-between gap-3 px-3 py-2 flex-1 min-w-0">
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-fg-primary leading-tight">Select {noun}</span>
            <span className="text-2xs text-fg-faint leading-tight truncate">Click to toggle. Shift-click to select a range.</span>
          </div>
          <Tooltip text="Exit selection (Esc)" position="bottom">
            <button type="button" className={CLOSE_BUTTON} onClick={onClose} aria-label="Exit selection">
              <X size={14} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
});
