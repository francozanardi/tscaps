import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { LayerCssVariable } from '@core/elements/domain/LayerCssVariable';

/**
 * The least space kept between a layer's box and the edges of what it
 * sits in, in hundredths of the frame's shorter side.
 */
export class LayerPaddingField implements ElementField {
  readonly id = ElementFieldId.PADDING;

  readonly section = ElementFieldSection.LAYOUT;

  /** A layer is the only element that wears it, and a layer has one surface. */
  controlFor(): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Padding',
      part: 'whole',
      type: 'number',
      unit: 'cqmin',
      min: 0,
      max: 20,
      step: 0.5,
      property: LayerCssVariable.PADDING,
    };
  }

  /** Nothing is laid out around a layer for it to take a value from. */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
