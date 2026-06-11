import type { ControlField, ControlValue } from '@core/templates/domain/ControlField';

/**
 * Immutable snapshot of the user's style-control values for the current
 * template. Stores a single map keyed by field id; switching templates
 * rebuilds the snapshot from the new template's defaults (no carry-over).
 *
 * Pure data — the CSS custom-property derivation lives in
 * `StyleValuesCssVarsBuilder`, which receives the snapshot per call and
 * holds the `UserBlobUrlResolver` it needs to render image fields.
 */
export class StyleValues {
  constructor(
    private readonly _fields: readonly ControlField[],
    private readonly _values: Readonly<Record<string, ControlValue>>,
  ) {}

  get values(): Readonly<Record<string, ControlValue>> {
    return this._values;
  }

  withValue(field: ControlField, value: ControlValue): StyleValues {
    return new StyleValues(this._fields, { ...this._values, [field.id]: value });
  }

  /**
   * Yields every `(field, value)` pair the snapshot carries, skipping
   * fields whose value is unset. Field order matches the template's
   * declaration order.
   */
  *entries(): IterableIterator<[ControlField, ControlValue]> {
    for (const field of this._fields) {
      const value = this._values[field.id];
      if (value === undefined) continue;
      yield [field, value];
    }
  }

  /** Builds StyleValues for a template, seeded with each field's default. */
  static fromTemplate(fields: readonly ControlField[]): StyleValues {
    const values: Record<string, ControlValue> = {};
    for (const field of fields) values[field.id] = field.default;
    return new StyleValues(fields, values);
  }
}
