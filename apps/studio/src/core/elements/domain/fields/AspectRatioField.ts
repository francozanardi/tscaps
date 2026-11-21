import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { LayerCssVariable } from '@core/elements/domain/LayerCssVariable';

/**
 * A box's width over its height. Left unset, the box takes the shape of
 * the file it shows.
 */
export class AspectRatioField implements ElementField {
  readonly id = ElementFieldId.ASPECT_RATIO;

  readonly section = ElementFieldSection.LAYOUT;

  /** A layer is the only element that wears it, and a layer has one surface. */
  controlFor(): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Shape',
      part: 'whole',
      type: 'number',
      min: 0.2,
      max: 5,
      step: 0.01,
      property: LayerCssVariable.ASPECT_RATIO,
    };
  }

  /** Nothing is laid out around a layer for it to take a value from. */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
