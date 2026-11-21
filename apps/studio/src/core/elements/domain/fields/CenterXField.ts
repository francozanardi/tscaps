import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { LayerCssVariable } from '@core/elements/domain/LayerCssVariable';

/**
 * Where across the frame a box's centre is, from its left edge (0) to
 * its right edge (1).
 */
export class CenterXField implements ElementField {
  readonly id = ElementFieldId.CENTER_X;

  readonly section = ElementFieldSection.LAYOUT;

  /** A layer is the only element that wears it, and a layer has one surface. */
  controlFor(): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Across',
      part: 'whole',
      type: 'number',
      min: 0,
      max: 1,
      step: 0.01,
      readAs: 'percent',
      property: LayerCssVariable.CENTER_X,
    };
  }

  /** Nothing is laid out around a layer for it to take a value from. */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
