import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { LayerCssVariable } from '@core/elements/domain/LayerCssVariable';

/**
 * How much of a split frame's long side the layer's part takes.
 */
export class SplitRatioField implements ElementField {
  readonly id = ElementFieldId.SPLIT_RATIO;

  readonly section = ElementFieldSection.LAYOUT;

  /** A layer is the only element that wears it, and a layer has one surface. */
  controlFor(): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Size',
      part: 'whole',
      type: 'number',
      min: 0.3,
      max: 0.7,
      step: 0.01,
      readAs: 'percent',
      property: LayerCssVariable.SPLIT_RATIO,
    };
  }

  /** Nothing is laid out around a layer for it to take a value from. */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
