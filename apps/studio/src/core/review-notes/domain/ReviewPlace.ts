import type { ReviewMark } from '@core/review-notes/domain/ReviewMark';
import type { ReviewPoint } from '@core/review-notes/domain/ReviewPoint';

/** Where on the frame a note points. */
export interface ReviewPlace {
  /** Where the note's comment hangs: the point picked, or the end of the last mark. */
  readonly at: ReviewPoint;
  /**
   * Width over height of the output frame when the note was made. The
   * points are shares of the frame, so after a change of aspect they
   * land somewhere else on the picture.
   */
  readonly frameAspect: number;
  /** What was drawn, oldest first; empty for a comment on a point. */
  readonly marks: ReadonlyArray<ReviewMark>;
}
