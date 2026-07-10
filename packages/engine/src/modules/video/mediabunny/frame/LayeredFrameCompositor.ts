import type {
  FrameCompositionRequest,
  FrameCompositor,
} from '@modules/video/mediabunny/frame/FrameCompositor';

/**
 * Paints the source frame at the base, then the frame-invariant
 * overlay on top of it, then the per-timestamp subtitle layer, then
 * the optional top layer used by effects that need to occlude the
 * captions (e.g. text-behind-actor). Captions stay readable through
 * any overlay decoration; the top layer, when supplied, paints on top
 * of the captions.
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
    if (request.captions) {
      request.captions.draw(target, 0, 0, request.width, request.height);
    }
    if (request.topLayer) {
      request.topLayer.draw(target, 0, 0, request.width, request.height);
    }
  }
}
