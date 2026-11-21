import { memo } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, type LucideIcon } from 'lucide-react';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { ShotLayerMotionFieldView, ShotLayerMotionForm } from '@presentation/shots/services/ShotLayerMotionForm';
import { SegmentedChoice } from '@ui/_shared/components/controls/fields/SegmentedChoice';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';

interface ShotLayerMotionFieldControlProps {
  form: ShotLayerMotionForm;
  view: ShotLayerMotionFieldView;
  /** Whether the layers it edits together hold different values of it. */
  mixed: boolean;
  /** Called on every change, a slider's included; the write is expected to coalesce a drag into one step. */
  onChange: (controlId: string, value: ElementControlValue) => void;
}

// A direction is an angle the layer travels at; these are the four a
// direction field offers, drawn as the way they point.
const DIRECTION_ICONS: Readonly<Record<string, LucideIcon>> = {
  '180deg': ArrowLeft,
  '0deg': ArrowRight,
  '270deg': ArrowUp,
  '90deg': ArrowDown,
};
const DIRECTION_ICON_SIZE = 14;

/** One field of a picked motion: a slider for a number, a segmented choice for the rest — four arrows for a direction. */
export const ShotLayerMotionFieldControl = memo(function ShotLayerMotionFieldControl({
  form,
  view,
  mixed,
  onChange,
}: ShotLayerMotionFieldControlProps) {
  if (view.kind === 'number') {
    return (
      <Slider
        label={view.control.label}
        value={view.shown}
        min={view.min}
        max={view.max}
        step={view.step}
        unit={view.unit}
        mixed={mixed}
        onChange={(shown) => onChange(view.control.id, form.recordedValue(view, shown))}
      />
    );
  }
  const options = (view.control.options ?? []).map((option) => {
    const Icon = DIRECTION_ICONS[option.value];
    return Icon === undefined
      ? { value: option.value, label: option.label }
      : { value: option.value, label: option.label, icon: <Icon size={DIRECTION_ICON_SIZE} /> };
  });
  return (
    <SegmentedChoice
      label={view.control.label}
      value={view.value}
      mixed={mixed}
      options={options}
      onChange={(value) => onChange(view.control.id, value)}
    />
  );
});
