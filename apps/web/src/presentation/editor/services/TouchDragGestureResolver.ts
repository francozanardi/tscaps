const DIRECTION_THRESHOLD_PX = 6;

export type TouchDragGestureDecision = 'pending' | 'horizontal' | 'vertical';

/**
 * Decides whether a touch pointer commits to a horizontal drag —
 * the caller should treat it as a selection — or a vertical drag —
 * the caller should let the surface scroll natively. Stays in
 * `'pending'` until the pointer's distance from the anchor exceeds
 * a small pixel threshold, at which point the dominant axis wins
 * permanently for this gesture.
 */
export class TouchDragGestureResolver {

  private anchorX = 0;
  private anchorY = 0;
  private decision: TouchDragGestureDecision = 'pending';

  begin(anchorX: number, anchorY: number): void {
    this.anchorX = anchorX;
    this.anchorY = anchorY;
    this.decision = 'pending';
  }

  update(x: number, y: number): TouchDragGestureDecision {
    if (this.decision !== 'pending') return this.decision;
    const dx = Math.abs(x - this.anchorX);
    const dy = Math.abs(y - this.anchorY);
    if (Math.max(dx, dy) < DIRECTION_THRESHOLD_PX) return 'pending';
    this.decision = dx > dy ? 'horizontal' : 'vertical';
    return this.decision;
  }

  get current(): TouchDragGestureDecision {
    return this.decision;
  }

  reset(): void {
    this.decision = 'pending';
  }
}
