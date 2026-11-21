import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { LayerCssVariable } from '@core/elements/domain/LayerCssVariable';

/** Which edge of a layer's life a picture-in-picture transition plays at. */
export type InsetTransitionEdge = 'entrance' | 'exit';

/**
 * How what floats in a picture-in-picture box comes in, or leaves: at
 * once, in its box, or from the whole frame, shrinking into it (and
 * growing back to it as it leaves).
 */
export class InsetTransitionField implements ElementField {
  readonly id: ElementFieldId;

  readonly section = ElementFieldSection.LAYOUT;

  constructor(private readonly edge: InsetTransitionEdge) {
    this.id = edge === 'entrance' ? ElementFieldId.INSET_ENTRANCE : ElementFieldId.INSET_EXIT;
  }

  /** A layer is the only element that wears it, and a layer has one surface. */
  controlFor(): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Picture in picture',
      part: 'whole',
      type: 'select',
      options: [{ value: '0', label: 'Cut' }, { value: '1', label: 'Full screen' }],
      property: this.edge === 'entrance' ? LayerCssVariable.INSET_ENTRANCE : LayerCssVariable.INSET_EXIT,
    };
  }

  /** Nothing is laid out around a layer for it to take a value from. */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
