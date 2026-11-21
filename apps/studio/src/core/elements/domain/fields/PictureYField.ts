import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { LayerCssVariable } from '@core/elements/domain/LayerCssVariable';

/**
 * Which part down of the video's own picture its box keeps where the
 * picture is cropped, from its top edge (0) to its bottom edge (1).
 */
export class PictureYField implements ElementField {
  readonly id = ElementFieldId.PICTURE_Y;

  readonly section = ElementFieldSection.LAYOUT;

  /** A layer is the only element that wears it, and a layer has one surface. */
  controlFor(): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Vertical',
      part: 'whole',
      type: 'number',
      min: 0,
      max: 1,
      step: 0.01,
      readAs: 'percent',
      property: LayerCssVariable.PICTURE_Y,
    };
  }

  /** Nothing is laid out around a layer for it to take a value from. */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
