export interface DragCentroid {
  readonly centroidXFrac: number;
  readonly centroidYFrac: number;
  readonly boxWidthFrac: number;
  readonly boxHeightFrac: number;
}

/**
 * Pixel-to-fraction conversion for overlay drag gestures. Takes the
 * captured box rect at drag-start, the scaler rect (the frame), and
 * the cursor delta, and returns the box's centroid and dimensions as
 * fractions of the frame. Pure: the caller measures rects, this
 * derives.
 */
export class DragGeometryResolver {
  centroid(
    wrapperRect: DOMRect,
    scalerRect: DOMRect,
    deltaX: number,
    deltaY: number,
  ): DragCentroid {
    const centroidPxX = wrapperRect.left + wrapperRect.width / 2 - scalerRect.left + deltaX;
    const centroidPxY = wrapperRect.top + wrapperRect.height / 2 - scalerRect.top + deltaY;
    return {
      centroidXFrac: centroidPxX / scalerRect.width,
      centroidYFrac: centroidPxY / scalerRect.height,
      boxWidthFrac: wrapperRect.width / scalerRect.width,
      boxHeightFrac: wrapperRect.height / scalerRect.height,
    };
  }
}
