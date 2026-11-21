import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { LayerCssVariable } from '@core/elements/domain/LayerCssVariable';

/**
 * How wide a box is, as a share of the frame's width.
 */
export class BoxWidthField implements ElementField {
  readonly id = ElementFieldId.WIDTH;

  readonly section = ElementFieldSection.LAYOUT;

  /** A layer is the only element that wears it, and a layer has one surface. */
  controlFor(): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Size',
      part: 'whole',
      type: 'number',
      min: 0.1,
      max: 1,
      step: 0.01,
      readAs: 'percent',
      property: LayerCssVariable.WIDTH,
    };
  }

  /** Nothing is laid out around a layer for it to take a value from. */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
