import type { ReviewMark } from '@core/review-notes/domain/ReviewMark';
import type { ReviewPoint } from '@core/review-notes/domain/ReviewPoint';
import type { ReviewMarkGeometry, ReviewScreenBox } from '@presentation/review-notes/services/ReviewMarkGeometry';
import type { ReviewMarkingStore } from '@presentation/review-notes/stores/ReviewMarkingStore';

/** Opens the bubble of a note at `at`, marking `marks`. */
export type ReviewComposeRequest = (at: ReviewPoint, marks: ReadonlyArray<ReviewMark>) => void;

/** Below this share of the frame, a pen's next point adds nothing to the line. */
const PEN_STEP = 0.003;

/**
 * Turns presses on the frame into marks while marking: with the comment
 * tool a press opens a note there; with the pen, a drag draws, and letting go opens the note at the end of what was drawn,
 * keeping the marks already drawn for it. A slip too small to be a
 * drawing is dropped.
 */
export class ReviewFrameGestures {
  constructor(
    private readonly store: ReviewMarkingStore,
    private readonly geometry: ReviewMarkGeometry,
  ) {}

  /** Answers whether the press starts a drag the caller should keep the pointer for. */
  press(frame: ReviewScreenBox, clientX: number, clientY: number, compose: ReviewComposeRequest): boolean {
    const point = this.geometry.pointIn(frame, clientX, clientY);
    const { tool } = this.store.snapshot();
    if (tool === 'comment') {
      compose(point, []);
      return false;
    }
    this.store.beginMark(point);
    return true;
  }

  move(frame: ReviewScreenBox, clientX: number, clientY: number): void {
    const { drawing } = this.store.snapshot();
    if (drawing === null) return;
    const point = this.geometry.pointIn(frame, clientX, clientY);
    const last = drawing.points[drawing.points.length - 1];
    if (last !== undefined && Math.hypot(point.x - last.x, point.y - last.y) < PEN_STEP) return;
    this.store.extendMark(point);
  }

  release(compose: ReviewComposeRequest): void {
    const mark = this.store.endMark();
    if (mark === null || this.geometry.isNegligible(mark)) return;
    const marks = [...this.store.pendingMarks(), mark];
    const end = this.geometry.endOf(marks);
    if (end !== null) compose(end, marks);
  }
}
