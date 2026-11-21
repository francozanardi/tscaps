import type { FootageCompositionRequest } from '@modules/video/FootageCompositor';
import { type FootageBox, FootageFraming } from '@modules/video/FootageFraming';
import { FootageGradeMath } from '@modules/video/grade/FootageGradeMath';

/**
 * Whether composing a request would draw the source's own picture
 * exactly as it is, and nothing else: no grade changes it, every
 * active layer shows the source's picture, none re-frames it into a `videoRect`, and the
 * topmost stands at rest in a box that is the frame — not one grown past
 * it, which crops the picture closer — from a picture of the
 * frame's own shape — one a cover would crop by less than a pixel of the
 * frame, which is rounding, not another shape. A request with no layer
 * active holds where the source's picture is of the frame's shape.
 *
 * Where it holds, the source's frame can be shown untouched instead of
 * composed, which is what lets a consumer skip composing frames whose
 * layers change nothing.
 */
export class SourcePictureAsIs {
  holds(request: FootageCompositionRequest): boolean {
    const { layers } = request;
    if (request.grade && !new FootageGradeMath().isNeutral(request.grade)) return false;
    if (layers.length === 0) return this.sameShape(request);
    if (layers.some((entry) => entry.layer.source.kind !== 'source-picture' || entry.state.videoRect !== null)) return false;
    const framing = new FootageFraming(layers[layers.length - 1]!.state, request.width, request.height);
    return framing.isAtRest() && framing.coversWholeFrame() && this.isTheFrame(framing.box(), request) && this.sameShape(request);
  }

  /** Whether `box` is the frame, to within a pixel on each edge. */
  private isTheFrame(box: FootageBox, request: FootageCompositionRequest): boolean {
    return Math.abs(box.x) < 1 && Math.abs(box.y) < 1
      && Math.abs(box.x + box.width - request.width) < 1 && Math.abs(box.y + box.height - request.height) < 1;
  }

  private sameShape(request: FootageCompositionRequest): boolean {
    if (!(request.videoWidth > 0 && request.videoHeight > 0 && request.width > 0 && request.height > 0)) return false;
    const pictureShape = request.videoWidth / request.videoHeight;
    const frameShape = request.width / request.height;
    const croppedShare = Math.abs(pictureShape / frameShape - 1);
    return croppedShare * Math.max(request.width, request.height) < 1;
  }
}
