import { memo } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  readonly value: string;
  readonly label: string;
}

interface SelectProps {
  label: string;
  value: string;
  options: readonly SelectOption[];
  disabled?: boolean | undefined;
  onChange: (value: string) => void;
}

const SELECT_CLS =
  'w-full h-[26px] pl-2 pr-7 text-xs text-fg-secondary bg-surface-2 border border-edge-medium rounded-xs cursor-pointer appearance-none ' +
  'transition-colors duration-quick ease-standard ' +
  'enabled:hover:border-edge-strong ' +
  'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

/**
 * Native dropdown styled to match the slider/toggle row layout. The native
 * caret is hidden via `appearance-none`; a Lucide chevron is overlaid on
 * the right (purely cosmetic — pointer-events-none so clicks fall through
 * to the underlying select).
 */
export const Select = memo(function Select({
  label,
  value,
  options,
  disabled,
  onChange,
}: SelectProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-fg-muted min-w-[90px] shrink-0">{label}</span>
      <div className="relative flex-1">
        <select
          className={SELECT_CLS}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={12}
          aria-hidden="true"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none"
        />
      </div>
    </div>
  );
});
