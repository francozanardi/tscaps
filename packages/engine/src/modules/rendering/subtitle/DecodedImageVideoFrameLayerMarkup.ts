import { CssClass } from '@modules/document/CssClass';
import { CssVariable } from '@modules/document/CssVariable';
import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';
import type { VideoFrameLayerMarkup } from '@modules/rendering/subtitle/VideoFrameLayerMarkup';

/** The `url("…")` value `CssVariable.VIDEO_FRAME` carries; the frame slice's URL never holds a `"`. */
const VIDEO_FRAME_VALUE = /^url\("([^"]*)"\)$/;

const HTML_ATTR_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;',
};

/**
 * A layer element holding the frame slice as an `<img decoding="sync">`
 * that fills it, for a host that leaves a large CSS background out of
 * the first draw of an SVG image: it decodes such a background only once
 * something paints it, and paints nothing until then. A synchronously
 * decoded image is in that first draw.
 *
 * The layer drops the baseline background for it: while a background of
 * the same URL is in place, Safari leaves the image out of that first
 * draw as well. Whatever else a
 * stylesheet does to the layer reaches the image as it reached the
 * background.
 *
 * Without a frame slice in `wrapperStyles` the layer is left empty.
 */
export class DecodedImageVideoFrameLayerMarkup implements VideoFrameLayerMarkup {

  render(wrapperStyles: InlineStyleMap): string {
    const frameUrl = this.frameUrlOf(wrapperStyles);
    if (frameUrl === null) return `<div class="${CssClass.VIDEO_FRAME_LAYER}"></div>`;
    return `<div class="${CssClass.VIDEO_FRAME_LAYER}" style="background-image: none;">`
      + `<img decoding="sync" alt="" src="${this.escapeAttributeValue(frameUrl)}" style="display: block; width: 100%; height: 100%;"/>`
      + `</div>`;
  }

  private frameUrlOf(wrapperStyles: InlineStyleMap): string | null {
    const value = wrapperStyles[CssVariable.VIDEO_FRAME];
    if (value === undefined) return null;
    return VIDEO_FRAME_VALUE.exec(value)?.[1] ?? null;
  }

  private escapeAttributeValue(value: string): string {
    return value.replace(/[&"<>]/g, (c) => HTML_ATTR_ENTITIES[c]!);
  }
}
