import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';

/**
 * Whether a picture shown in a box of another shape is cropped to fill
 * it or shown whole inside it.
 */
export class ObjectFitField implements ElementField {
  readonly id = ElementFieldId.FIT;

  readonly section = ElementFieldSection.LAYOUT;

  /** A layer is the only element that wears it, and a layer has one surface. */
  controlFor(): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Fit',
      part: 'whole',
      type: 'select',
      options: [{ value: 'cover', label: 'Fill' }, { value: 'contain', label: 'Fit' }],
      property: 'object-fit',
    };
  }

  /** Nothing is laid out around a layer for it to take a value from. */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
