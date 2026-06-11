import { memo } from 'react';
import type { ControlField, ControlValue } from '@core/templates/domain/ControlField';
import { FieldView } from '@ui/editor/components/controls/FieldView';
import { Section } from '@ui/editor/components/controls/Section';

interface FieldsSectionProps {
  /** Optional. Omit when the surrounding tab already provides the title. */
  title?: string | undefined;
  fields: readonly ControlField[];
  values: Readonly<Record<string, ControlValue | undefined>>;
  onChange: (field: ControlField, value: ControlValue) => void;
  disabled?: boolean;
}

const STRUCTURE_LOCK_MESSAGE =
  "Layout is locked. Toggle the 'Auto-layout' field above to restore it.";

/**
 * Renders a `ControlField[]` as a Section. Non-color fields are dropped as
 * direct children of Section's content (so they inherit the standard row
 * gap), and color fields are laid out in an auto-fill grid that packs as
 * many swatches per row as the available width allows.
 *
 * Used for: per-template style groups (Colors, Appearance), Effects, Scenes
 * (segment splitter), Lines (line splitter).
 */
export const FieldsSection = memo(function FieldsSection({
  title,
  fields,
  values,
  onChange,
  disabled,
}: FieldsSectionProps) {
  if (fields.length === 0) return null;

  const colors = fields.filter((f) => f.type === 'color');
  const others = fields.filter((f) => f.type !== 'color');

  return (
    <Section
      title={title}
      disabled={disabled}
      disabledMessage={STRUCTURE_LOCK_MESSAGE}
    >
      {others.map((field) => (
        <FieldView
          key={field.id}
          field={field}
          value={values[field.id] ?? field.default}
          onChange={onChange}
          disabled={disabled ?? false}
        />
      ))}
      {colors.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-1.5">
          {colors.map((field) => (
            <FieldView
              key={field.id}
              field={field}
              value={values[field.id] ?? field.default}
              onChange={onChange}
              disabled={disabled ?? false}
            />
          ))}
        </div>
      )}
    </Section>
  );
});
