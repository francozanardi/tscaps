import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';

/**
 * The markup of a segment's video-frame layer, the element
 * `CssClass.VIDEO_FRAME_LAYER` names.
 *
 * `wrapperStyles` are the inline styles the segment's wrapper carries,
 * where the frame slice arrives as `CssVariable.VIDEO_FRAME`. A wrapper
 * built only to measure geometry carries none, and the layer is then
 * empty either way.
 */
export interface VideoFrameLayerMarkup {
  render(wrapperStyles: InlineStyleMap): string;
}
