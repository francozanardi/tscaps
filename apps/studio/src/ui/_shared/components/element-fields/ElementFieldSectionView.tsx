import { memo, useCallback, useMemo } from 'react';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { FontFaceSlot } from '@core/fonts/domain/FontScript';
import { IconToggleStrip, type IconToggleItem } from '@ui/_shared/components/controls/fields/IconToggleStrip';
import { ElementFieldControl, elementFieldLabelClass } from '@ui/_shared/components/element-fields/ElementFieldControl';
import { elementFieldIcon } from '@ui/_shared/components/element-fields/ElementFieldIcons';

interface ElementFieldSectionViewProps {
  controls: ReadonlyArray<AuthoredElementControl>;
  /** What each field was left at, or what it arrives at from further out. */
  shown: Readonly<Record<string, ElementControlValue | undefined>>;
  /** Ids of the fields whose declaration the CSS has taken over. */
  takenByCss: ReadonlySet<string>;
  compact?: boolean | undefined;
  onChange: (control: AuthoredElementControl, value: ElementControlValue) => void;
  /** Alphabets the element's own text is written in, the most used first. */
  scripts: ReadonlyArray<FontFaceSlot>;
}

const STRIP_LABEL = 'Style';

/** The value the property reads with the switch on, and with it off. */
function statesOf(control: AuthoredElementControl): { readonly on: string; readonly off: string } {
  return { off: control.options?.[0]?.value ?? '', on: control.options?.[1]?.value ?? '' };
}

/**
 * The rows of one group of an element's fields.
 *
 * The switches small enough to go by a picture share a single row of
 * icons; everything else follows as a labelled row, in the order the
 * element offers it. A switch the CSS has taken over stays in that row,
 * dimmed: the panel says which field stopped being driven without
 * rearranging itself, since a field that moves reads as a different set
 * of fields rather than as the same one under new management.
 */
export const ElementFieldSectionView = memo(function ElementFieldSectionView({
  controls,
  shown,
  takenByCss,
  compact,
  onChange,
  scripts,
}: ElementFieldSectionViewProps) {
  const stripControls = useMemo(
    () => controls.filter((control) => control.type === 'toggle' && elementFieldIcon(control.id) !== null),
    [controls],
  );
  const stripIds = useMemo(() => new Set(stripControls.map((control) => control.id)), [stripControls]);
  const rowControls = useMemo(
    () => controls.filter((control) => !stripIds.has(control.id)),
    [controls, stripIds],
  );

  const items = useMemo<ReadonlyArray<IconToggleItem>>(
    () => stripControls.map((control) => ({
      id: control.id,
      label: control.label,
      icon: elementFieldIcon(control.id),
      pressed: shown[control.id] === statesOf(control).on,
      customized: takenByCss.has(control.id),
    })),
    [stripControls, shown, takenByCss],
  );

  const handleToggle = useCallback((id: string, pressed: boolean) => {
    const control = stripControls.find((candidate) => candidate.id === id);
    if (!control) return;
    const { on, off } = statesOf(control);
    onChange(control, pressed ? on : off);
  }, [stripControls, onChange]);

  return (
    <>
      {items.length > 0 && (
        <div className="flex items-center gap-2">
          <span className={elementFieldLabelClass(compact === true)}>{STRIP_LABEL}</span>
          <IconToggleStrip items={items} ariaLabel={STRIP_LABEL} onToggle={handleToggle} />
        </div>
      )}
      {rowControls.map((control) => (
        <ElementFieldControl
          key={control.id}
          control={control}
          shown={shown[control.id]}
          controlledByCss={takenByCss.has(control.id)}
          compact={compact}
          onChange={onChange}
          scripts={scripts}
        />
      ))}
    </>
  );
});
