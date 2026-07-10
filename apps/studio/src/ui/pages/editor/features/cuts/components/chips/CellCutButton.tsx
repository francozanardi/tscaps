import { Scissors } from 'lucide-react';

const CELL_CUT_BUTTON_CLASS =
  'pointer-events-auto inline-flex items-center justify-center w-5 h-5 rounded-xs shadow-sm ' +
  'bg-surface-1 border border-edge-medium text-fg-secondary cursor-pointer ' +
  'opacity-0 group-hover/chip:opacity-100 ' +
  'transition-[opacity,border-color,color,transform] duration-quick ease-standard ' +
  'hover:border-danger hover:text-danger hover:scale-110 ' +
  'focus-visible:outline-none focus-visible:opacity-100 focus-visible:border-accent';

interface CellCutButtonProps {
  label: string;
  onCut: () => void;
}

/**
 * Centered scissors affordance shown on hover/focus inside a word or
 * gap chip. Stops pointer-down so the surrounding timeline drag-zone
 * doesn't start a selection on click.
 */
export function CellCutButton({ label, onCut }: CellCutButtonProps) {
  return (
    <button
      type="button"
      className={CELL_CUT_BUTTON_CLASS}
      style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      title={label}
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onCut(); }}
    >
      <Scissors size={12} />
    </button>
  );
}
