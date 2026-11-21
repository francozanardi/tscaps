import type { ReviewNote } from '@core/review-notes/domain/ReviewNote';

/** Notes sent together, as a review is submitted: every draft there was at that moment. */
export interface ReviewBatch {
  readonly id: string;
  /** In the order they were made. */
  readonly notes: ReadonlyArray<ReviewNote>;
}
