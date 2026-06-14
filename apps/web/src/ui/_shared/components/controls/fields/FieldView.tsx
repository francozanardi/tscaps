import { memo, type ReactNode } from 'react';
import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { Toggle } from '@ui/_shared/components/controls/fields/Toggle';
import { Select } from '@ui/_shared/components/controls/fields/Select';
import { ColorPicker } from '@ui/_shared/components/controls/fields/ColorPicker';
import { TextInput } from '@ui/_shared/components/controls/fields/TextInput';
import { ImagePicker } from '@ui/_shared/components/controls/fields/ImagePicker';
import { FontPicker } from '@ui/_shared/components/controls/fields/FontPicker';

interface FieldViewProps {
  field: ControlField;
  value: ControlValue;
  onChange: (field: ControlField, value: ControlValue) => void;
  disabled?: boolean;
}

/**
 * Renders a single `ControlField` by dispatching to the appropriate atom
 * (Slider / Toggle / Select / ColorPicker). Used by `FieldsSection` to
 * lay out the generic style-control list of a Template. If the field
 * declares a `legend`, it's shown as muted help text below the control.
 */
export const FieldView = memo(function FieldView({
  field,
  value,
  onChange,
  disabled,
}: FieldViewProps) {
  let control: ReactNode = null;

  if (field.type === 'color') {
    control = (
      <ColorPicker
        label={field.label}
        value={String(value)}
        disabled={disabled}
        onChange={(v) => onChange(field, v)}
      />
    );
  } else if (field.type === 'integer' || field.type === 'float') {
    const step = field.step ?? (field.type === 'float' ? 0.1 : 1);
    control = (
      <Slider
        label={field.label}
        value={Number(value)}
        min={field.min ?? 0}
        max={field.max ?? 100}
        step={step}
        unit={field.unit}
        disabled={disabled}
        onChange={(v) => onChange(field, v)}
      />
    );
  } else if (field.type === 'select') {
    control = (
      <Select
        label={field.label}
        value={String(value)}
        options={field.options ?? []}
        disabled={disabled}
        onChange={(v) => onChange(field, v)}
      />
    );
  } else if (field.type === 'toggle') {
    control = (
      <Toggle
        label={field.label}
        value={Boolean(value)}
        disabled={disabled}
        onChange={(v) => onChange(field, v)}
      />
    );
  } else if (field.type === 'text') {
    control = (
      <TextInput
        label={field.label}
        value={String(value)}
        disabled={disabled}
        onChange={(v) => onChange(field, v)}
      />
    );
  } else if (field.type === 'image') {
    control = (
      <ImagePicker
        field={field}
        value={String(value)}
        disabled={disabled}
      />
    );
  } else if (field.type === 'font') {
    control = (
      <div className="flex items-start gap-2">
        <span className="text-xs text-fg-muted min-w-[90px] shrink-0 pt-[5px]">{field.label}</span>
        <FontPicker
          value={String(value)}
          disabled={disabled}
          onChange={(v) => onChange(field, v)}
        />
      </div>
    );
  }

  if (control === null) return null;
  if (field.legend === undefined) return control;
  return (
    <div className="flex flex-col gap-1">
      {control}
      <p className="text-2xs text-fg-faint leading-snug m-0">{field.legend}</p>
    </div>
  );
});
