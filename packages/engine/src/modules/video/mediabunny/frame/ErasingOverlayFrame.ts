import type { OverlayFrame } from '@modules/rendering/OverlayFrameRenderer';

/**
 * Draws an overlay as an eraser: wherever it has coverage, what is
 * already in the destination is removed in proportion to it, and none
 * of the overlay's own colour is painted.
 *
 * Does not own the overlay it wraps.
 */
export class ErasingOverlayFrame implements OverlayFrame {

  constructor(private readonly overlay: OverlayFrame) {}

  // The operation is put back afterwards: the context outlives this draw,
  // and every other draw into it expects its own.
  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void {
    const previous = context.globalCompositeOperation;
    context.globalCompositeOperation = 'destination-out';
    try {
      this.overlay.draw(context, dx, dy, dWidth, dHeight);
    } finally {
      context.globalCompositeOperation = previous;
    }
  }
}
