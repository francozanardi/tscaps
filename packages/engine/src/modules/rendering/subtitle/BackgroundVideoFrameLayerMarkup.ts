import { CssClass } from '@modules/document/CssClass';
import type { VideoFrameLayerMarkup } from '@modules/rendering/subtitle/VideoFrameLayerMarkup';

/**
 * An empty layer element: the baseline rule paints the frame slice
 * as its CSS background, read from `CssVariable.VIDEO_FRAME`.
 */
export class BackgroundVideoFrameLayerMarkup implements VideoFrameLayerMarkup {

  render(): string {
    return `<div class="${CssClass.VIDEO_FRAME_LAYER}"></div>`;
  }
}
