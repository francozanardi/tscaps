import type { MouseEvent } from 'react';
import { Plus } from 'lucide-react';

interface ShotAddButtonProps {
  /** Whether what it opens is open, which holds it as it looks hovered. */
  isOpen: boolean;
  /** A shot cut away whole takes nothing until the cut is restored. */
  disabled: boolean;
  onOpen: (event: MouseEvent) => void;
}

// The pills' own size and type, outlined instead of filled: it is not
// something the shot holds, it is where the next one comes from. The
// dashed hairline plus one pixel of padding keeps the pills' height.
const BUTTON_CLASS =
  'group/add inline-flex items-center gap-1 px-1.5 py-px rounded-xs cursor-pointer '
  + 'border border-dashed border-edge-medium bg-transparent text-3xs font-medium leading-none text-fg-muted '
  + 'transition-colors duration-quick ease-standard '
  + 'enabled:hover:border-edge-strong enabled:hover:bg-edge-faint enabled:hover:text-fg-primary '
  + 'data-[open]:border-edge-strong data-[open]:bg-edge-faint data-[open]:text-fg-primary '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent '
  + 'disabled:opacity-40 disabled:cursor-not-allowed';
// The plus turns a quarter inside its own box on hover and while open:
// nothing around it moves. Still where motion is reduced.
const ICON_CLASS =
  'transition-transform duration-base ease-standard group-enabled/add:group-hover/add:rotate-90 group-data-[open]/add:rotate-90 '
  + 'motion-reduce:transition-none motion-reduce:!rotate-0';

/**
 * The button on a shot's card that opens what can be put on the shot,
 * at the end of the row of what it already holds. Shown on every card,
 * so a shot with nothing on it still says something can go there.
 */
export function ShotAddButton({ isOpen, disabled, onOpen }: ShotAddButtonProps) {
  return (
    <button
      type="button"
      className={BUTTON_CLASS}
      aria-label="Add to shot"
      aria-expanded={isOpen}
      data-open={isOpen || undefined}
      disabled={disabled}
      onClick={onOpen}
      onContextMenu={onOpen}
    >
      <Plus size={11} className={ICON_CLASS} aria-hidden />
      Add
    </button>
  );
}
