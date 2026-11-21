import { memo, type ReactNode } from 'react';
import * as Switch from '@radix-ui/react-switch';
import { FieldLabel } from '@ui/_shared/components/controls/fields/FieldLabel';
import { useScrollViewHold } from '@ui/_shared/hooks/useScrollViewHold';

interface ToggleProps {
  label: string;
  value: boolean;
  disabled?: boolean | undefined;
  /** Rendered next to the label, for a field whose name is not self-explanatory. */
  adornment?: ReactNode;
  /** Whether the elements this field edits together hold different values: the label marks it. */
  mixed?: boolean | undefined;
  onChange: (value: boolean) => void;
}

const SWITCH_ROOT =
  'relative inline-flex shrink-0 ml-auto w-8 h-[18px] rounded-pill bg-surface-3 border border-edge-medium cursor-pointer ' +
  'transition-colors duration-quick ease-standard outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-accent/40 ' +
  'data-[state=checked]:bg-accent/25 data-[state=checked]:border-accent ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

const SWITCH_THUMB =
  'block w-3.5 h-3.5 rounded-full bg-fg-muted translate-x-px ' +
  'transition-[transform,background-color] duration-quick ease-standard will-change-transform ' +
  'data-[state=checked]:translate-x-[15px] data-[state=checked]:bg-accent';

/**
 * Boolean field rendered as a switch, anchored to the right of the row.
 * Built on Radix Switch — keyboard, ARIA `role="switch"`, and focus
 * management come for free. Visual state is driven by `data-state` so a
 * single className stays flat (no per-render conditional).
 */
export const Toggle = memo(function Toggle({
  label,
  value,
  disabled,
  adornment,
  mixed,
  onChange,
}: ToggleProps) {
  const hold = useScrollViewHold();
  return (
    <div className="flex items-center gap-2">
      <FieldLabel label={label} mixed={mixed} />
      {adornment}
      <Switch.Root
        checked={value}
        disabled={disabled}
        onClick={(event) => hold(event.currentTarget)}
        onCheckedChange={onChange}
        aria-label={label}
        className={SWITCH_ROOT}
      >
        <Switch.Thumb className={SWITCH_THUMB} />
      </Switch.Root>
    </div>
  );
});
