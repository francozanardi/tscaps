import { FootageFraming, type FootagePicture, type PlacedSourcePicture } from '@tscaps/engine/advanced';

/**
 * Paints the actor's cutout: the picture shown, kept only where the
 * actor's mask says the actor is — the mask drawn where the source's own
 * picture landed on that picture (`sourcePicture`), in its state, so a
 * crop, a zoom or a split moves the cutout with the actor. The picture is
 * the one composed, footage and grade included, so the actor in front of
 * the captions is the actor on screen.
 *
 * Holds one scratch canvas for the placed mask, sized on demand and
 * reused across frames; one painter serves one canvas at a time.
 */
export class ActorCutoutPainter {
  private placedMask: OffscreenCanvas | null = null;
  private placedMaskContext: OffscreenCanvasRenderingContext2D | null = null;

  /**
   * Clears `context`'s `width × height` and paints the cutout on it:
   * `drawPicture` draws the picture shown over that whole area, and
   * `mask` is the mask measured on the source's picture, whatever its
   * own resolution.
   */
  paint(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    width: number,
    height: number,
    drawPicture: (target: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D) => void,
    mask: CanvasImageSource,
    sourcePicture: PlacedSourcePicture,
  ): void {
    const placedMask = this.maskPlaced(width, height, mask, sourcePicture);
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, width, height);
    drawPicture(context);
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(placedMask, 0, 0, width, height);
    context.globalCompositeOperation = 'source-over';
  }

  /** `mask` drawn where the source's picture lands on a `width × height` picture, transparent everywhere else. */
  private maskPlaced(width: number, height: number, mask: CanvasImageSource, sourcePicture: PlacedSourcePicture): OffscreenCanvas {
    const { canvas, context } = this.scratchOf(width, height);
    context.clearRect(0, 0, width, height);
    const maskPicture: FootagePicture = {
      draw: (target, x, y, drawnWidth, drawnHeight) => target.drawImage(mask, x, y, drawnWidth, drawnHeight),
    };
    new FootageFraming(sourcePicture.state, width, height)
      .draw(context, maskPicture, sourcePicture.pictureWidth, sourcePicture.pictureHeight);
    return canvas;
  }

  private scratchOf(width: number, height: number): { canvas: OffscreenCanvas; context: OffscreenCanvasRenderingContext2D } {
    if (this.placedMask === null || this.placedMaskContext === null) {
      this.placedMask = new OffscreenCanvas(width, height);
      const context = this.placedMask.getContext('2d');
      if (context === null) throw new Error('OffscreenCanvas 2D context is unavailable');
      this.placedMaskContext = context;
    }
    if (this.placedMask.width !== width) this.placedMask.width = width;
    if (this.placedMask.height !== height) this.placedMask.height = height;
    return { canvas: this.placedMask, context: this.placedMaskContext };
  }
}
