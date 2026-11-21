import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { LayerCssVariable } from '@core/elements/domain/LayerCssVariable';

/** What fills a layer's box around its file where the file is fitted inside it: black, or the file itself, blurred. */
export class LayerBackdropField implements ElementField {
  readonly id = ElementFieldId.BACKDROP;

  readonly section = ElementFieldSection.LAYOUT;

  /** A layer is the only element that wears it, and a layer has one surface. */
  controlFor(): AuthoredElementControl {
    return {
      id: this.id,
      label: 'Background',
      part: 'whole',
      type: 'select',
      options: [{ value: '1', label: 'Black' }, { value: '2', label: 'Blurred' }],
      property: LayerCssVariable.BACKDROP,
    };
  }

  /** Nothing is laid out around a layer for it to take a value from. */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
