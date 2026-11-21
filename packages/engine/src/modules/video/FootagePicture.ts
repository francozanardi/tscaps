/**
 * Anything that can paint itself, whole, into a box of a 2D context:
 * a decoded video frame, an image, a canvas.
 */
export interface FootagePicture {
  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void;
}
