import { memo, type ReactNode } from 'react';
import { useScrollViewHold } from '@ui/_shared/hooks/useScrollViewHold';

interface PictureChoiceOption {
  readonly value: string;
  readonly label: string;
  /** The option drawn, in `currentColor` where it wants the card's tone: muted at rest, accent when picked. */
  readonly picture: ReactNode;
}

interface PictureChoiceProps {
  /** Names the choice; also its accessible name. */
  label: string;
  /** Hides the label from sight where a heading right above already names the choice. */
  hideLabel?: boolean | undefined;
  value: string;
  options: readonly PictureChoiceOption[];
  /**
   * Lays every option out in one row, each card taking an even share of
   * the width. By default the cards keep a size of their own and wrap.
   */
  oneRow?: boolean | undefined;
  disabled?: boolean | undefined;
  onChange: (value: string) => void;
}

const LABEL_CLASS = 'text-xs text-fg-muted';
const GRID_CLASS = 'grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2';
const ONE_ROW_CLASS = 'grid grid-flow-col auto-cols-fr gap-2';
const CARD_CLASS =
  'flex flex-col items-stretch gap-1.5 p-2 rounded-sm border bg-surface-2 cursor-pointer '
  + 'transition-colors duration-quick ease-standard '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 '
  + 'disabled:opacity-40 disabled:cursor-not-allowed';
const CARD_AT_REST = 'border-edge-subtle text-fg-muted enabled:hover:border-edge-medium enabled:hover:text-fg-secondary';
const CARD_PICKED = 'border-accent bg-accent/10 text-accent';
const PICTURE_CLASS = 'flex items-center justify-center h-10';
// A name too long for its card wraps rather than losing its end.
const OPTION_LABEL_CLASS = 'text-3xs leading-tight text-center text-balance';

/**
 * One of a few options, each drawn as what it does. For a choice whose
 * options are easier told apart seen than named; a `Select` stays the
 * answer for a long list or one whose options have no picture.
 */
export const PictureChoice = memo(function PictureChoice({
  label,
  hideLabel,
  value,
  options,
  oneRow,
  disabled,
  onChange,
}: PictureChoiceProps) {
  const hold = useScrollViewHold();
  return (
    <div className="flex flex-col gap-1.5">
      {!hideLabel && <span className={LABEL_CLASS}>{label}</span>}
      <div className={oneRow ? ONE_ROW_CLASS : GRID_CLASS} role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const picked = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={picked}
              disabled={disabled}
              className={`${CARD_CLASS} ${picked ? CARD_PICKED : CARD_AT_REST}`}
              onClick={(event) => {
                hold(event.currentTarget);
                onChange(option.value);
              }}
            >
              <span className={PICTURE_CLASS} aria-hidden>{option.picture}</span>
              <span className={OPTION_LABEL_CLASS}>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
