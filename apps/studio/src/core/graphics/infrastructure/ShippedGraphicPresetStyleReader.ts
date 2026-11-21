import type { ElementStyle } from '@core/elements/domain/ElementStyles';
import type { GraphicPresetStyleReader } from '@core/graphics/domain/GraphicPresetStyleReader';

/**
 * The style of a preset shipped with the editor, which is always none: a
 * shipped preset gives its box and its motion, and keeps no layer style.
 */
export class ShippedGraphicPresetStyleReader implements GraphicPresetStyleReader {
  read(): ElementStyle | null {
    return null;
  }
}
