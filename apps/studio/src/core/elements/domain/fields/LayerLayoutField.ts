import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { LayerCssVariable } from '@core/elements/domain/LayerCssVariable';

/**
 * Which of the few named layouts a layer follows: on the whole frame,
 * in one part of a frame cut in two, or in a box over the video. Each
 * reads its own settings and ignores the others'.
 */
export class LayerLayoutField implements ElementField {
  readonly id = ElementFieldId.LAYOUT;

  readonly section = ElementFieldSection.LAYOUT;

  /** A layer is the only element that wears it, and a layer has one surface. */
  controlFor(): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Layout',
      part: 'whole',
      type: 'select',
      options: [
        { value: '0', label: 'Full screen' },
        { value: '1', label: 'Split screen' },
        { value: '2', label: 'Picture in picture' },
      ],
      property: LayerCssVariable.LAYOUT,
    };
  }

  /** Nothing is laid out around a layer for it to take a value from. */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
