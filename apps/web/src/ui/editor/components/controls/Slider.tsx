import { memo } from 'react';
import { NumericValueChip } from '@ui/editor/components/controls/NumericValueChip';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string | undefined;
  disabled?: boolean | undefined;
  compact?: boolean | undefined;
  onChange: (value: number) => void;
}

/**
 * Label + range input + editable numeric chip. The range gives quick
 * coarse adjustment; the chip lets the user type exact values when the
 * track is too narrow for the step granularity (common in `letterSpacing`
 * style fields on mobile widths).
 */
export const Slider = memo(function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  compact,
  onChange,
}: SliderProps) {
  const labelClass = compact
    ? 'text-xs text-fg-muted min-w-[70px] shrink-0'
    : 'text-xs text-fg-muted min-w-[90px] shrink-0';

  return (
    <div className="flex items-center gap-2">
      <span className={labelClass}>{label}</span>
      <input
        type="range"
        className="flex-1 min-w-0 h-[3px] cursor-pointer accent-accent"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <NumericValueChip
        value={value}
        min={min}
        max={max}
        step={step}
        unit={unit}
        disabled={disabled}
        ariaLabel={`${label} value`}
        onChange={onChange}
      />
    </div>
  );
});
