import { memo } from 'react';
import * as Switch from '@radix-ui/react-switch';

interface ToggleProps {
  label: string;
  value: boolean;
  disabled?: boolean | undefined;
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
  onChange,
}: ToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-fg-muted min-w-[90px] shrink-0">{label}</span>
      <Switch.Root
        checked={value}
        disabled={disabled}
        onCheckedChange={onChange}
        className={SWITCH_ROOT}
      >
        <Switch.Thumb className={SWITCH_THUMB} />
      </Switch.Root>
    </div>
  );
});
