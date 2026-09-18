import { memo, useCallback, type ReactNode } from 'react';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import { ColorPicker } from '@ui/_shared/components/controls/fields/ColorPicker';
import { CustomizedFieldOverlay } from '@ui/_shared/components/controls/fields/CustomizedFieldOverlay';
import { Toggle } from '@ui/_shared/components/controls/fields/Toggle';
import { FontStack } from '@core/fonts/domain/FontStack';
import type { FontFaceSlot } from '@core/fonts/domain/FontScript';
import { FontStackField } from '@ui/_shared/components/controls/fields/FontStackField';
import { Select } from '@ui/_shared/components/controls/fields/Select';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';

interface ElementFieldControlProps {
  control: AuthoredElementControl;
  /** The value on the field, or `undefined` when there is none to show. */
  shown: ElementControlValue | undefined;
  /** Narrower labels, for a popover rather than a sidebar. */
  compact?: boolean | undefined;
  /** Whether the declaration this field wrote is no longer the one it would write. */
  controlledByCss?: boolean | undefined;
  onChange: (control: AuthoredElementControl, value: ElementControlValue) => void;
  /** Alphabets this element's own text is written in, the most used first. */
  scripts: ReadonlyArray<FontFaceSlot>;
}

const DISCONNECTED_VALUE = 0;
const LABEL_CLASS = 'text-xs text-fg-muted shrink-0';

/**
 * The label column every row of an element's fields shares, narrower in
 * a popover than in the sidebar. `topAligned` is for a field taller than
 * one line, so its label sits with the first row rather than centred
 * against the whole thing.
 */
export function elementFieldLabelClass(compact: boolean, topAligned = false): string {
  return `${LABEL_CLASS} ${compact ? 'min-w-[70px]' : 'min-w-[90px]'}${topAligned ? ' pt-[5px]' : ''}`;
}

/**
 * One field of an element, over the value the element records for it.
 *
 * Nothing here reads CSS. The record is what was picked; the CSS is
 * built from it, and the hand-written CSS beside it is emitted after
 * and wins on its own without this having to know.
 */
export const ElementFieldControl = memo(function ElementFieldControl({
  control,
  shown,
  compact,
  controlledByCss,
  onChange,
  scripts,
}: ElementFieldControlProps) {
  const handleChange = useCallback(
    (next: ElementControlValue) => onChange(control, next),
    [control, onChange],
  );

  return (
    <CustomizedFieldOverlay customized={controlledByCss === true} label={control.label}>
      <div className="flex flex-col gap-1">
        {renderField(control, shown, handleChange, compact === true, scripts)}
        {control.legend !== undefined && (
          <p className="m-0 text-2xs text-fg-faint leading-snug">{control.legend}</p>
        )}
      </div>
    </CustomizedFieldOverlay>
  );
});

function renderField(
  control: AuthoredElementControl,
  value: ElementControlValue | undefined,
  onChange: (value: ElementControlValue) => void,
  compact: boolean,
  scripts: ReadonlyArray<FontFaceSlot>,
): ReactNode {
  // A switch's two options are the CSS the property reads with it off
  // and with it on, so the pressed state is simply the second one.
  if (control.type === 'toggle') {
    const [off, on] = [control.options?.[0]?.value ?? '', control.options?.[1]?.value ?? ''];
    return (
      <Toggle
        label={control.label}
        value={value === on}
        onChange={(pressed) => onChange(pressed ? on : off)}
      />
    );
  }
  if (control.type === 'select') {
    return (
      <Select label={control.label} value={String(value ?? '')} options={control.options ?? []} onChange={onChange} />
    );
  }
  // The swatch drops its own label and joins the column the rows around
  // it use, so every row of the panel reads left to right the same way.
  if (control.type === 'color') {
    return (
      <div className="flex items-center gap-2">
        <span className={elementFieldLabelClass(compact)}>{control.label}</span>
        <ColorPicker label="" value={String(value ?? '')} onChange={onChange} />
      </div>
    );
  }
  if (control.type === 'font') {
    const stack = FontStack.fromStoredFaces(value);
    if (stack === null) return null;
    return (
      <FontStackField
        label={control.label}
        stack={stack}
        scripts={scripts}
        onChange={(next) => onChange(next.toSnapshot())}
      />
    );
  }
  return (
    <Slider
      label={control.label}
      value={typeof value === 'number' ? value : DISCONNECTED_VALUE}
      min={control.min ?? 0}
      max={control.max ?? 1}
      step={control.step ?? 0.01}
      unit={control.unit}
      compact={compact}
      onChange={onChange}
    />
  );
}
