import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { LayerCssVariable } from '@core/elements/domain/LayerCssVariable';

/**
 * How round the corners are of what a layer floats or splits, in
 * hundredths of the frame's shorter side, so a corner keeps its look at
 * whatever size the frame is drawn. Written as a custom property the
 * framework rounds with: the box's corners, or the video's where the
 * video floats over the layer.
 */
export class CornerRadiusField implements ElementField {
  readonly id = ElementFieldId.CORNER_RADIUS;

  readonly section = ElementFieldSection.LAYOUT;

  /** A layer is the only element that wears it, and a layer has one surface. */
  controlFor(): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Corners',
      part: 'whole',
      type: 'number',
      unit: 'cqmin',
      min: 0,
      max: 50,
      step: 0.5,
      property: LayerCssVariable.CORNER_RADIUS,
    };
  }

  /** Nothing is laid out around a layer for it to take a value from. */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
