import { memo, type ReactNode } from 'react';
import { useScrollViewHold } from '@ui/_shared/hooks/useScrollViewHold';

interface ElementAnimationCardProps {
  label: string;
  selected: boolean;
  /** What it is drawn as, sized to the card by its own markup. */
  icon: ReactNode;
  onSelect: () => void;
  /** Why it cannot be picked here, said on hover; null or absent where it can. */
  disabledReason?: string | null | undefined;
  /** What hovering it says while it is picked; "Play again" where absent. */
  selectedTitle?: string | undefined;
  /** Told when the pointer or the focus comes onto the card and leaves it, for a caller that shows the answer before it is picked. */
  onPreviewChange?: ((previewing: boolean) => void) | undefined;
}

const CARD_CLASS =
  'group flex flex-col items-stretch gap-1.5 p-2 rounded-sm border bg-surface-2 cursor-pointer '
  + 'transition-colors duration-quick ease-standard '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';
const CARD_AT_REST = 'border-edge-subtle text-fg-muted hover:border-edge-medium hover:text-fg-secondary';
const CARD_SELECTED = 'border-accent bg-accent/10 text-accent';
const CARD_DISABLED = 'border-edge-subtle text-fg-faint opacity-60 cursor-not-allowed';

const ICON_CLASS = 'flex items-center justify-center h-10';
const LABEL_CLASS = 'text-3xs leading-none text-center truncate';

/**
 * One answer in the animation picker, drawn as what it does.
 *
 * A picture rather than a preview. What the library animates is written
 * in `em` against caption text, so an entrance played at the size of a
 * card travels a pixel or two and shows nothing — measured, over the
 * whole catalogue. Seeing the motion itself is a question for the
 * element on screen, not for a thumbnail — which the chosen card says
 * on hover, since nothing else offers to play it again.
 */
export const ElementAnimationCard = memo(function ElementAnimationCard({
  label,
  selected,
  icon,
  onSelect,
  disabledReason,
  selectedTitle,
  onPreviewChange,
}: ElementAnimationCardProps) {
  const hold = useScrollViewHold();
  const disabled = disabledReason !== null && disabledReason !== undefined;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-disabled={disabled}
      title={disabled ? disabledReason : selected ? selectedTitle ?? 'Play again' : undefined}
      className={`${CARD_CLASS} ${disabled ? CARD_DISABLED : selected ? CARD_SELECTED : CARD_AT_REST}`}
      onClick={(event) => {
        if (disabled) return;
        hold(event.currentTarget);
        onSelect();
      }}
      onPointerEnter={onPreviewChange && (() => onPreviewChange(true))}
      onPointerLeave={onPreviewChange && (() => onPreviewChange(false))}
      onFocus={onPreviewChange && (() => onPreviewChange(true))}
      onBlur={onPreviewChange && (() => onPreviewChange(false))}
    >
      <span className={ICON_CLASS} aria-hidden>{icon}</span>
      <span className={LABEL_CLASS}>{label}</span>
    </button>
  );
});
