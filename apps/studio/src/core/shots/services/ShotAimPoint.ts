/**
 * Turns a point of the source picture a view should centre on into the
 * share of what the view leaves out, which is how a framing is stored,
 * and back. Along one axis, a view `side` wide (a share of the picture)
 * centred at `point` is moved inside the picture where the point is too
 * near an edge. A view of the whole picture has nowhere to go: no share.
 */
export class ShotAimPoint {
  /** The share of the picture along one axis a view at `scale` shows, `span` the picture's span along it in output frames. */
  sideOf(scale: number, span: number): number {
    return Math.min(1, 1 / (scale * span));
  }

  /** The share that centres a view `side` wide on `point`, or null where the view is the whole picture. */
  shareOf(point: number, side: number): number | null {
    if (!(side < 1)) return null;
    return Math.min(1 - side, Math.max(0, point - side / 2)) / (1 - side);
  }

  /** The point a view `side` wide placed at `share` is centred on. */
  pointOf(share: number, side: number): number {
    return share * (1 - side) + side / 2;
  }
}
