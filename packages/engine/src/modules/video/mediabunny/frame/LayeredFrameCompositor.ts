import type {
  FrameCompositionRequest,
  FrameCompositor,
  CaptionLayerFrame,
} from '@modules/video/mediabunny/frame/FrameCompositor';
import { CaptionStacking } from '@modules/rendering/types/CaptionStacking';

/**
 * Paints the source frame at the base, then the frame-invariant
 * overlay on top of it, then the caption layers under the top layer,
 * then the optional top layer used by effects that need to occlude the
 * captions (e.g. text-behind-actor), then the caption layers over it.
 * Captions stay readable through any overlay decoration; the top layer
 * occludes only the captions under it.
 *
 * Each caption layer is composited with its own blend mode against
 * everything already painted, which is what a blend means: the video,
 * the overlay, the captions beneath it and, over the top layer, the
 * top layer too. A request that does not blend captions composites
 * every layer plainly.
 */
export class LayeredFrameCompositor implements FrameCompositor {

  compose(
    target: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    request: FrameCompositionRequest,
  ): void {
    request.frame.draw(target, 0, 0, request.width, request.height);
    if (request.overlay) {
      request.overlay.draw(target, 0, 0, request.width, request.height);
    }
    this.drawCaptions(target, request, CaptionStacking.UNDER_TOP_LAYER);
    if (request.topLayer) {
      request.topLayer.draw(target, 0, 0, request.width, request.height);
    }
    this.drawCaptions(target, request, CaptionStacking.OVER_TOP_LAYER);
  }

  private drawCaptions(
    target: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    request: FrameCompositionRequest,
    stacking: CaptionStacking,
  ): void {
    for (const caption of request.captions) {
      if (caption.layer.stacking === stacking) this.drawLayer(target, request, caption);
    }
  }

  // The operation is put back after each layer: the context outlives
  // this frame, and every other draw into it is plain source-over.
  private drawLayer(
    target: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    request: FrameCompositionRequest,
    { layer, frame }: CaptionLayerFrame,
  ): void {
    const previous = target.globalCompositeOperation;
    target.globalCompositeOperation = request.blendCaptions ? layer.compositeOperation() : 'source-over';
    try {
      frame.draw(target, 0, 0, request.width, request.height);
    } finally {
      target.globalCompositeOperation = previous;
    }
  }
}
