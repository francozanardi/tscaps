import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { LayerCssVariable } from '@core/elements/domain/LayerCssVariable';

/**
 * Which part of a split frame a layer takes: the top, or the left on a
 * horizontal frame, or the other one.
 */
export class SplitSideField implements ElementField {
  readonly id = ElementFieldId.SPLIT_SIDE;

  readonly section = ElementFieldSection.LAYOUT;

  /** A layer is the only element that wears it, and a layer has one surface. */
  controlFor(): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Side',
      part: 'whole',
      type: 'select',
      options: [{ value: '0', label: 'Start' }, { value: '1', label: 'End' }],
      property: LayerCssVariable.SPLIT_SIDE,
    };
  }

  /** Nothing is laid out around a layer for it to take a value from. */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
