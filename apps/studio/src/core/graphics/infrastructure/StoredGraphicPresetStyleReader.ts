import { ElementStyles, type ElementStyle } from '@core/elements/domain/ElementStyles';
import type { GraphicPresetStyleReader } from '@core/graphics/domain/GraphicPresetStyleReader';

// The key a stored style is read under; any key does, the style is read alone.
const STYLE_KEY = 'layer';

/** A preset's stored style read as `ElementStyles` reads a stored one; a style that is not a layer's is none. */
export class StoredGraphicPresetStyleReader implements GraphicPresetStyleReader {
  read(value: unknown): ElementStyle | null {
    if (typeof value !== 'object' || value === null) return null;
    const style = ElementStyles.fromSnapshot({ [STYLE_KEY]: value as ElementStyle }).get(STYLE_KEY);
    return style !== null && style.kind === 'layer' ? style : null;
  }
}
