import type { ReviewNoteRef } from '@core/review-notes/domain/ReviewNoteRef';
import type { ReviewNoteStatus } from '@core/review-notes/domain/ReviewNoteStatus';
import type { ReviewPlace } from '@core/review-notes/domain/ReviewPlace';

/** A note as a project stores it. */
export interface SerializedReviewNote {
  readonly id: string;
  readonly number: number;
  /** ISO 8601. */
  readonly createdAt: string;
  readonly sourceSec: number;
  readonly place: ReviewPlace | null;
  readonly refs: ReadonlyArray<ReviewNoteRef>;
  readonly quote: string | null;
  readonly text: string;
  readonly status: ReviewNoteStatus;
  readonly batchId: string | null;
}

/** A project's notes as it stores them, in the order they were made. */
export type ReviewNotesSnapshot = ReadonlyArray<SerializedReviewNote>;
