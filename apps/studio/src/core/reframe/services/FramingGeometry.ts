import type { PictureCrop } from '@core/reframe/domain/PictureCrop';
import type { PicturePoint } from '@core/reframe/domain/PicturePoint';
import type { PictureSpan } from '@core/shots/services/ShotPictureArea';

/** One axis of the picture: across (`x`) or down (`y`). */
export type PictureAxis = 'x' | 'y';

/**
 * Where views of the source picture fall in an output frame of another
 * shape, as shares of the picture: how much of it a view at a closeness
 * shows, the crop it shows centred on a point (moved inside the picture
 * where the point is near an edge, as the frame itself stops there), and
 * points to centre on, spread along an axis or close around one.
 * Immutable.
 */
export class FramingGeometry {
  /** `span` is how many output frames of picture there are along each axis (more than 1 along the one the frame crops). */
  constructor(private readonly span: PictureSpan) {}

  /** The axis the frame crops the picture on at its own closeness, or null where it shows all of it. */
  croppedAxis(): PictureAxis | null {
    if (this.span.x > 1) return 'x';
    if (this.span.y > 1) return 'y';
    return null;
  }

  /** The share of the picture a view at `scale` shows along `axis`. */
  sideAt(scale: number, axis: PictureAxis): number {
    return Math.min(1, 1 / (scale * this.span[axis]));
  }

  /** The part of the picture a view at `scale` centred on `point` shows. */
  cropAt(point: PicturePoint, scale: number): PictureCrop {
    const centred = this.centreFor(point, scale);
    const width = this.sideAt(scale, 'x');
    const height = this.sideAt(scale, 'y');
    return { left: centred.x - width / 2, top: centred.y - height / 2, width, height };
  }

  /** Where a view at `scale` asked to centre on `point` is centred: nearest to it with the whole view inside the picture. */
  centreFor(point: PicturePoint, scale: number): PicturePoint {
    return { x: this.centreAlong(point.x, scale, 'x'), y: this.centreAlong(point.y, scale, 'y') };
  }

  /** `count` points spread evenly along `axis` from the first place a view at `scale` fits to the last, `across` on the other axis. */
  spread(axis: PictureAxis, count: number, scale: number, across: number): PicturePoint[] {
    const half = this.sideAt(scale, axis) / 2;
    const step = count > 1 ? (1 - 2 * half) / (count - 1) : 0;
    return Array.from({ length: count }, (_, index) => this.pointAlong(axis, half + index * step, across));
  }

  /** The distance between two of `count` points spread along `axis` at `scale`. */
  spreadStep(axis: PictureAxis, count: number, scale: number): number {
    return count > 1 ? (1 - this.sideAt(scale, axis)) / (count - 1) : 0;
  }

  /** `count` points along `axis`, `step` apart and centred on `centre`, each moved to where a view at `scale` can centre. */
  around(centre: PicturePoint, axis: PictureAxis, count: number, step: number, scale: number): PicturePoint[] {
    const middle = (count - 1) / 2;
    return Array.from({ length: count }, (_, index) => {
      const along = centre[axis] + (index - middle) * step;
      return this.centreFor(this.pointAlong(axis, along, axis === 'x' ? centre.y : centre.x), scale);
    });
  }

  private centreAlong(at: number, scale: number, axis: PictureAxis): number {
    const half = this.sideAt(scale, axis) / 2;
    return Math.min(1 - half, Math.max(half, at));
  }

  private pointAlong(axis: PictureAxis, along: number, across: number): PicturePoint {
    return axis === 'x' ? { x: along, y: across } : { x: across, y: along };
  }
}
