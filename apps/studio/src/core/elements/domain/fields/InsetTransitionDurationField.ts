import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import type { InsetTransitionEdge } from '@core/elements/domain/fields/InsetTransitionField';
import { LayerCssVariable } from '@core/elements/domain/LayerCssVariable';

/** How long what floats in a picture-in-picture box takes to shrink into it as the layer comes in, or to grow out of it as it leaves. */
export class InsetTransitionDurationField implements ElementField {
  readonly id: ElementFieldId;

  readonly section = ElementFieldSection.LAYOUT;

  constructor(private readonly edge: InsetTransitionEdge) {
    this.id = edge === 'entrance' ? ElementFieldId.INSET_ENTRANCE_DURATION : ElementFieldId.INSET_EXIT_DURATION;
  }

  /** A layer is the only element that wears it, and a layer has one surface. */
  controlFor(): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Duration',
      part: 'whole',
      type: 'number',
      unit: 's',
      min: 0.1,
      max: 2,
      step: 0.05,
      property: this.edge === 'entrance' ? LayerCssVariable.INSET_ENTRANCE_DURATION : LayerCssVariable.INSET_EXIT_DURATION,
    };
  }

  /** Nothing is laid out around a layer for it to take a value from. */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
