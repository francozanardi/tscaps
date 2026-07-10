export type ResizeCorner = 'tl' | 'tr' | 'bl' | 'br';

/**
 * Computes the uniform scale factor for a corner-handle resize gesture.
 * The factor is the ratio between the cursor's distance from the
 * wrapper's center now and the dragged corner's distance from that
 * same center at drag start. Pure: caller measures rects, this
 * derives.
 *
 * Returns `1` when the original distance is zero (degenerate
 * zero-sized wrapper) so callers can multiply safely. The result is
 * never clamped here — bounds belong to the caller, alongside the
 * domain min/max it knows about.
 */
export class ResizeGeometryResolver {
  scale(wrapperRect: DOMRect, corner: ResizeCorner, deltaX: number, deltaY: number): number {
    const centerX = wrapperRect.left + wrapperRect.width / 2;
    const centerY = wrapperRect.top + wrapperRect.height / 2;
    const cornerX = this.isLeftCorner(corner) ? wrapperRect.left : wrapperRect.right;
    const cornerY = this.isTopCorner(corner) ? wrapperRect.top : wrapperRect.bottom;
    const originalDistance = Math.hypot(cornerX - centerX, cornerY - centerY);
    if (originalDistance === 0) return 1;
    const nextDistance = Math.hypot(cornerX + deltaX - centerX, cornerY + deltaY - centerY);
    return nextDistance / originalDistance;
  }

  private isLeftCorner(corner: ResizeCorner): boolean {
    return corner === 'tl' || corner === 'bl';
  }

  private isTopCorner(corner: ResizeCorner): boolean {
    return corner === 'tl' || corner === 'tr';
  }
}
