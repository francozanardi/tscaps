import { memo } from 'react';
import { NumericValueChip } from '@ui/_shared/components/controls/fields/NumericValueChip';
import { FIELD_LABEL_CLASS } from '@ui/_shared/components/controls/fields/field-label-classes';
import { FieldLabel } from '@ui/_shared/components/controls/fields/FieldLabel';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string | undefined;
  disabled?: boolean | undefined;
  compact?: boolean | undefined;
  /** Whether the elements this field edits together hold different values: the label marks it. */
  mixed?: boolean | undefined;
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
  mixed,
  onChange,
}: SliderProps) {
  const labelClass = compact
    ? 'text-xs text-fg-muted min-w-[70px] shrink-0'
    : FIELD_LABEL_CLASS;

  return (
    <div className="flex items-center gap-2">
      <FieldLabel label={label} mixed={mixed} className={labelClass} />
      <input
        type="range"
        className="flex-1 min-w-0 h-[3px] cursor-pointer accent-accent"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
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
