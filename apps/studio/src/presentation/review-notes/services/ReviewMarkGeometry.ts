import type { ReviewMark } from '@core/review-notes/domain/ReviewMark';
import type { ReviewPoint } from '@core/review-notes/domain/ReviewPoint';

/** Below this share of the frame a mark is a slip of the pointer, not a drawing. */
const NEGLIGIBLE_SHARE = 0.01;

/** Where the frame sits on screen, in pixels; a `DOMRect` is one. */
export interface ReviewScreenBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A box on the frame, in shares of its width and height. */
export interface ReviewBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Plain geometry over marks in shares of the frame. */
export class ReviewMarkGeometry {
  /** Where `clientX`, `clientY` falls on `frame`, in shares of it, held inside it. */
  pointIn(frame: ReviewScreenBox, clientX: number, clientY: number): ReviewPoint {
    return {
      x: this.clamp(frame.width === 0 ? 0 : (clientX - frame.left) / frame.width),
      y: this.clamp(frame.height === 0 ? 0 : (clientY - frame.top) / frame.height),
    };
  }

  /** Where a note's comment hangs once these marks are drawn: the end of the last one. */
  endOf(marks: ReadonlyArray<ReviewMark>): ReviewPoint | null {
    const last = marks[marks.length - 1];
    if (last === undefined) return null;
    return last.points[last.points.length - 1] ?? null;
  }

  /** The smallest box holding every point of a stroke. */
  boxOf(points: ReadonlyArray<ReviewPoint>): ReviewBox {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
  }

  /** Whether a mark is too small to be meant: a click with the pen. */
  isNegligible(mark: ReviewMark): boolean {
    const box = this.boxOf(mark.points);
    return box.right - box.left < NEGLIGIBLE_SHARE && box.bottom - box.top < NEGLIGIBLE_SHARE;
  }

  /**
   * An SVG path for a mark, in a box `100 × aspect` wide and 100 tall:
   * the frame's own proportions. `aspect` is the frame's width over its
   * height.
   */
  pathOf(mark: ReviewMark, aspect: number): string {
    return mark.points.map((point, index) => `${index === 0 ? 'M' : 'L'}${this.round(point.x * 100 * aspect)} ${this.round(point.y * 100)}`).join(' ');
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private clamp(share: number): number {
    return Math.min(1, Math.max(0, share));
  }
}
