import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';
import type { GlyphInkExtents } from '@modules/rendering/subtitle/GlyphInkReader';
import { CssVariable } from '@modules/document/CssVariable';

/**
 * How each element of one rendered caption came out: how wide each
 * element was laid out, and how far each line's glyphs reach above and
 * below its baseline, all as multiples of the font size the element
 * renders at.
 *
 * The multiple is what makes the answer usable: a stylesheet deriving a
 * font size from a width cannot be told the width in pixels, because
 * the pixels it would be told are the ones its own answer produces. A
 * measure in `em` is free of that, so it stays true whatever size the
 * measurement happened to be taken at.
 */
export class ElementMeasures {

  constructor(
    private readonly widthEmByElementId: ReadonlyMap<string, number>,
    private readonly inkByElementId: ReadonlyMap<string, GlyphInkExtents> = new Map(),
  ) {}

  static empty(): ElementMeasures {
    return new ElementMeasures(new Map());
  }

  /**
   * The named custom property carrying `elementId`'s width, or nothing
   * at all when the element was not measured — so a caller can spread
   * the result unconditionally.
   */
  varsFor(property: string, elementId: string): InlineStyleMap {
    const widthEm = this.widthEmByElementId.get(elementId);
    return widthEm === undefined ? {} : { [property]: String(widthEm) };
  }

  /** The ink properties of `elementId`, or nothing when its ink was not measured. */
  inkVarsFor(elementId: string): InlineStyleMap {
    const ink = this.inkByElementId.get(elementId);
    if (ink === undefined) return {};
    return {
      [CssVariable.LINE_INK_ASCENT_EM]: String(ink.ascentEm),
      [CssVariable.LINE_INK_DESCENT_EM]: String(ink.descentEm),
    };
  }
}
