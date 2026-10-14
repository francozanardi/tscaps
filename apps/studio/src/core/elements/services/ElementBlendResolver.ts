import { CaptionBlendMode } from '@tscaps/engine';
import type { ElementBlendMode } from '@core/elements/domain/ElementEffects';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';

/** The renderer's name for each blend the editor offers. */
const CAPTION_BLEND_MODES: Readonly<Record<ElementBlendMode, CaptionBlendMode>> = {
  difference: CaptionBlendMode.DIFFERENCE,
};

/**
 * Turns the blend an element carries into the blend mode the renderer
 * composites it with.
 *
 * The one place that answers it, for the preview and the export alike:
 * two answers would let the editor show a blend the burned video does
 * not carry.
 */
export class ElementBlendResolver {

  /** The blend mode the element is composited with, or `null` when it does not blend. */
  blendModeOf(elementId: string, elementStyles: ElementStyles): CaptionBlendMode | null {
    const blend = elementStyles.blendOf(elementId);
    return blend === null ? null : CAPTION_BLEND_MODES[blend];
  }
}
