import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import { LayerCssVariable } from '@core/elements/domain/LayerCssVariable';

/** Which part of a framing an end field holds: across or down. */
export type PictureEndSetting = 'x' | 'y';

const IDS: Readonly<Record<PictureEndSetting, ElementFieldId>> = {
  x: ElementFieldId.PICTURE_END_X,
  y: ElementFieldId.PICTURE_END_Y,
};

const PROPERTIES: Readonly<Record<PictureEndSetting, LayerCssVariable>> = {
  x: LayerCssVariable.PICTURE_END_X,
  y: LayerCssVariable.PICTURE_END_Y,
};

/**
 * Where a box showing the video's own picture looks at the end of its
 * camera move: the part kept across or down (a share of what is cropped
 * away), as its start's fields name it.
 */
export class PictureEndField implements ElementField {
  readonly id: ElementFieldId;

  readonly section = ElementFieldSection.LAYOUT;

  constructor(private readonly setting: PictureEndSetting) {
    this.id = IDS[setting];
  }

  /** A layer is the only element that wears it, and a layer has one surface. */
  controlFor(): AuthoredElementControl {
    return {
      id: this.id,
      label: this.setting === 'x' ? 'End horizontal' : 'End vertical',
      part: 'whole',
      type: 'number',
      min: 0,
      max: 1,
      step: 0.01,
      readAs: 'percent',
      property: PROPERTIES[this.setting],
    };
  }

  /** Nothing is laid out around a layer for it to take a value from. */
  inheritsFromAncestor(): boolean {
    return false;
  }
}
