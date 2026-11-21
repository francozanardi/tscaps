import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { LayerCssVariable } from '@core/elements/domain/LayerCssVariable';

/** What floats in a picture-in-picture box: the layer, over the video, or the video, over the layer. */
export class InsetSubjectField implements ElementField {
  readonly id = ElementFieldId.INSET_SUBJECT;

  readonly section = ElementFieldSection.LAYOUT;

  /** A layer is the only element that wears it, and a layer has one surface. */
  controlFor(): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Floating',
      part: 'whole',
      type: 'select',
      options: [{ value: '0', label: 'Layer' }, { value: '1', label: 'Video' }],
      property: LayerCssVariable.INSET_VIDEO,
    };
  }

  /** Nothing is laid out around a layer for it to take a value from. */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
