import { MixedValueMarker } from '@ui/_shared/components/controls/fields/MixedValueMarker';
import { FIELD_LABEL_CLASS } from '@ui/_shared/components/controls/fields/field-label-classes';

interface FieldLabelProps {
  label: string;
  /** Whether the elements the field edits together hold different values; the label says so under its name. */
  mixed?: boolean | undefined;
  /** The label column's class, where a row narrower than the shared grid wants its own. */
  className?: string | undefined;
}

/** A field row's label, in the label column every row shares. */
export function FieldLabel({ label, mixed = false, className = FIELD_LABEL_CLASS }: FieldLabelProps) {
  return (
    <span className={className}>
      {label}
      {mixed && <MixedValueMarker />}
    </span>
  );
}
