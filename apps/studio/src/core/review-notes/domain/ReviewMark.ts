import type { ReviewPoint } from '@core/review-notes/domain/ReviewPoint';

/**
 * Something drawn on the frame to show where a note points: a line
 * drawn by hand, the points the pen went through, in order. `kind`
 * names it in what a project stores.
 */
export interface ReviewMark {
  readonly kind: 'stroke';
  readonly points: ReadonlyArray<ReviewPoint>;
}
