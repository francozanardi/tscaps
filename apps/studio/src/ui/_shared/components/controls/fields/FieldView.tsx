import { memo, type ReactNode } from 'react';
import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import { CustomizedFieldOverlay } from '@ui/_shared/components/controls/fields/CustomizedFieldOverlay';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { Toggle } from '@ui/_shared/components/controls/fields/Toggle';
import { Select } from '@ui/_shared/components/controls/fields/Select';
import { ColorPicker } from '@ui/_shared/components/controls/fields/ColorPicker';
import { TextInput } from '@ui/_shared/components/controls/fields/TextInput';
import { ImagePicker } from '@ui/_shared/components/controls/fields/ImagePicker';
import { FontStack } from '@core/fonts/domain/FontStack';
import type { FontFaceSlot } from '@core/fonts/domain/FontScript';
import { FontStackField } from '@ui/_shared/components/controls/fields/FontStackField';

interface FieldViewProps {
  field: ControlField;
  value: ControlValue;
  onChange: (field: ControlField, value: ControlValue) => void;
  disabled?: boolean;
  /** Whether the sheet's own CSS stopped reading this control's variable. */
  customized?: boolean;
  /** Alphabets the captions this control styles are written in, the most used first. */
  scripts: ReadonlyArray<FontFaceSlot>;
}


function withLegend(control: ReactNode, legend: string | undefined): ReactNode {
  if (legend === undefined) return control;
  return (
    <div className="flex flex-col gap-1">
      {control}
      <p className="text-2xs text-fg-faint leading-snug m-0">{legend}</p>
    </div>
  );
}

/**
 * Renders a single `ControlField` by dispatching to the appropriate atom
 * (Slider / Toggle / Select / ColorPicker). Used by `FieldsSection` to
 * lay out the generic style-control list of a Template. If the field
 * declares a `legend`, it's shown as muted help text below the control.
 * Fields marked `cloudOnly` render on the `local` surface as a gated,
 * non-interactive affordance that routes to the upgrade landing.
 */
export const FieldView = memo(function FieldView({
  field,
  value,
  onChange,
  disabled,
  customized,
  scripts,
}: FieldViewProps) {

  let control: ReactNode = null;

  if (field.type === 'color') {
    control = (
      <ColorPicker
        label={field.label}
        value={String(value)}
        hint={field.legend}
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
    // Which words a template's own rule paints with this face is the
    // template's business, and unknowable here — so it offers a face for
    // every alphabet the sheet holds. Offering one nothing ends up using
    // costs a row; missing one leaves those words on the device's font.
    const stack = FontStack.fromStoredFaces(value) ?? FontStack.fromStoredFaces(field.default);
    control = stack === null ? null : (
      <FontStackField
        label={field.label}
        stack={stack}
        scripts={scripts}
        disabled={disabled}
        onChange={(next) => onChange(field, next.toSnapshot())}
      />
    );
  }

  if (control === null) return null;
  // A colour sits in a dense grid of swatches, so its help cannot be a block
  // under the control: a grid row takes the height of its tallest cell, and one
  // legend would stretch the whole row and leave the swatches beside it adrift
  // in the space it opened. It rides the label instead.
  const blockLegend = field.type === 'color' ? undefined : field.legend;
  return withLegend(
    <CustomizedFieldOverlay customized={customized === true} label={field.label} controlIds={[field.id]}>
      {control}
    </CustomizedFieldOverlay>,
    blockLegend,
  );
});
