import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { LayerCssVariable } from '@core/elements/domain/LayerCssVariable';

/** Which edge of a layer's life a split transition plays at. */
export type SplitTransitionEdge = 'entrance' | 'exit';

/**
 * How a split frame divides as the layer comes in, or joins back as it
 * leaves: at once, its part sliding in with the dividing line, or the
 * line uncovering it where it rests.
 */
export class SplitTransitionField implements ElementField {
  readonly id: ElementFieldId;

  readonly section = ElementFieldSection.LAYOUT;

  constructor(private readonly edge: SplitTransitionEdge) {
    this.id = edge === 'entrance' ? ElementFieldId.SPLIT_ENTRANCE : ElementFieldId.SPLIT_EXIT;
  }

  /** A layer is the only element that wears it, and a layer has one surface. */
  controlFor(): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Split',
      part: 'whole',
      type: 'select',
      options: [{ value: '0', label: 'Cut' }, { value: '1', label: 'Slide' }, { value: '2', label: 'Reveal' }],
      property: this.edge === 'entrance' ? LayerCssVariable.SPLIT_ENTRANCE : LayerCssVariable.SPLIT_EXIT,
    };
  }

  /** Nothing is laid out around a layer for it to take a value from. */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
