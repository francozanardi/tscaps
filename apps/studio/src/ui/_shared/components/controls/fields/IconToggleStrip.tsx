import { memo, type ReactNode } from 'react';
import { useScrollViewHold } from '@ui/_shared/hooks/useScrollViewHold';

/** One button of the strip: what it stands for, what it looks like, and whether it is on. */
export interface IconToggleItem {
  readonly id: string;
  /** Named for the user — the tooltip, and what assistive technology reads. */
  readonly label: string;
  readonly icon: ReactNode;
  readonly pressed: boolean;
  /**
   * Whether the stylesheet decides this one now. It stays where it is,
   * showing what it holds, and stops answering the pointer.
   */
  readonly customized?: boolean | undefined;
}

interface IconToggleStripProps {
  items: ReadonlyArray<IconToggleItem>;
  ariaLabel: string;
  onToggle: (id: string, pressed: boolean) => void;
}

const CUSTOMIZED_NOTE = 'your CSS controls this';

const TOGGLE_BASE =
  'flex items-center justify-center w-7 h-6 rounded-xs cursor-pointer ' +
  'transition-colors duration-quick ease-standard ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30';
const ACTIVE = `${TOGGLE_BASE} bg-accent/20 text-fg-primary border border-accent`;
const INACTIVE = `${TOGGLE_BASE} bg-transparent text-fg-secondary border border-transparent hover:bg-surface-3`;
const CUSTOMIZED = 'opacity-40 cursor-not-allowed hover:bg-transparent';

/**
 * A row of small icon buttons, each on or off on its own.
 *
 * A segmented row rather than one switch per line, for answers short
 * enough that a label beside each would say less than the icon does.
 * The wrapping border and background are part of this atom; callers
 * provide their own row or label around it.
 *
 * A customized button is dimmed where it stands and says so in its own
 * name, since the pill used for a full-width field does not fit here.
 * It keeps its place in the row: a panel that rearranges itself reads
 * as a different set of fields rather than as one that stopped being
 * driven.
 */
export const IconToggleStrip = memo(function IconToggleStrip({ items, ariaLabel, onToggle }: IconToggleStripProps) {
  const hold = useScrollViewHold();
  return (
    <div
      className="flex rounded-xs border border-edge-medium bg-surface-2 p-[2px] gap-[2px]"
      role="group"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const customized = item.customized === true;
        const name = customized ? `${item.label} — ${CUSTOMIZED_NOTE}` : item.label;
        return (
          <button
            key={item.id}
            type="button"
            disabled={customized}
            aria-pressed={item.pressed}
            aria-label={name}
            title={name}
            className={`${item.pressed ? ACTIVE : INACTIVE}${customized ? ` ${CUSTOMIZED}` : ''}`}
            onClick={(event) => {
              hold(event.currentTarget);
              onToggle(item.id, !item.pressed);
            }}
          >
            {item.icon}
          </button>
        );
      })}
    </div>
  );
});
