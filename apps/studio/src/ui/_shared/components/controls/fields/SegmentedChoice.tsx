import { memo, type ReactNode } from 'react';
import { FieldLabel } from '@ui/_shared/components/controls/fields/FieldLabel';
import { useScrollViewHold } from '@ui/_shared/hooks/useScrollViewHold';

interface SegmentedChoiceOption {
  readonly value: string;
  /** The option's word; with an icon, its accessible name and its tooltip instead. */
  readonly label: string;
  /** Drawn in place of the word, for an option an icon says better. */
  readonly icon?: ReactNode;
  /** Said on hover, for an option whose word alone does not say what it does. */
  readonly tooltip?: string | undefined;
}

interface SegmentedChoiceProps {
  /**
   * The row's label, in the label column every field row shares; the
   * segments fill the rest of the row. Omit it to let the segments take
   * the whole row; `ariaLabel` then names the group.
   */
  label?: string | undefined;
  ariaLabel?: string | undefined;
  /** Whether the elements this field edits together hold different values: the label marks it. */
  mixed?: boolean | undefined;
  /** The picked option, or null when the value is none of them: then no segment reads as picked. */
  value: string | null;
  options: readonly SegmentedChoiceOption[];
  onChange: (value: string) => void;
}

const GROUP_CLASS = 'flex flex-1 min-w-0 rounded-xs border border-edge-medium bg-surface-2 p-[2px] gap-[2px]';
const SEGMENT_BASE =
  'flex flex-1 min-w-0 items-center justify-center px-1 py-1 rounded-xs whitespace-nowrap text-xs cursor-pointer transition-colors duration-quick ease-standard '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30';
const SEGMENT_PICKED = `${SEGMENT_BASE} bg-accent/20 text-fg-primary border border-accent`;
const SEGMENT_AT_REST =
  `${SEGMENT_BASE} bg-transparent text-fg-secondary border border-transparent hover:bg-surface-3 focus-visible:bg-surface-3`;

/**
 * One of a few short answers, as a row of words or of icons. The
 * segmented rows the typography controls draw, as a single choice; a
 * `Select` stays the answer for a long list, a `PictureChoice` for
 * options better seen at the size of a card.
 *
 * The segments share the width they are given evenly, so two choices
 * stacked in one panel line up whatever their words.
 */
export const SegmentedChoice = memo(function SegmentedChoice({
  label,
  ariaLabel,
  mixed,
  value,
  options,
  onChange,
}: SegmentedChoiceProps) {
  const hold = useScrollViewHold();
  const group = (
    <div className={GROUP_CLASS} role="radiogroup" aria-label={ariaLabel ?? label}>
      {options.map((option) => {
        const picked = option.value === value;
        const hasIcon = option.icon !== undefined;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={picked}
            aria-label={hasIcon ? option.label : undefined}
            title={option.tooltip ?? (hasIcon ? option.label : undefined)}
            className={picked ? SEGMENT_PICKED : SEGMENT_AT_REST}
            onClick={(event) => {
              hold(event.currentTarget);
              onChange(option.value);
            }}
          >
            {hasIcon ? option.icon : option.label}
          </button>
        );
      })}
    </div>
  );
  if (label === undefined) return group;
  return (
    <div className="flex items-center gap-2">
      <FieldLabel label={label} mixed={mixed} />
      {group}
    </div>
  );
});
