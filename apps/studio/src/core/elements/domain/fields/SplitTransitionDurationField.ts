import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import type { SplitTransitionEdge } from '@core/elements/domain/fields/SplitTransitionField';
import { LayerCssVariable } from '@core/elements/domain/LayerCssVariable';

/** How long a split frame takes to divide as the layer comes in, or to join back as it leaves. */
export class SplitTransitionDurationField implements ElementField {
  readonly id: ElementFieldId;

  readonly section = ElementFieldSection.LAYOUT;

  constructor(private readonly edge: SplitTransitionEdge) {
    this.id = edge === 'entrance' ? ElementFieldId.SPLIT_ENTRANCE_DURATION : ElementFieldId.SPLIT_EXIT_DURATION;
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
      property: this.edge === 'entrance' ? LayerCssVariable.SPLIT_ENTRANCE_DURATION : LayerCssVariable.SPLIT_EXIT_DURATION,
    };
  }

  /** Nothing is laid out around a layer for it to take a value from. */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
