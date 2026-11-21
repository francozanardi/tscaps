import type { ReviewNoteRef } from '@core/review-notes/domain/ReviewNoteRef';
import type { ReviewNoteStatus } from '@core/review-notes/domain/ReviewNoteStatus';
import type { ReviewPlace } from '@core/review-notes/domain/ReviewPlace';

/**
 * Something the person wants changed, said at one moment of the video
 * and, optionally, at a place on the frame. Its moment and place are
 * what anchor it; its refs only hint at what was there.
 */
export interface ReviewNote {
  readonly id: string;
  /** 1, 2, 3… in the order notes were made in the project: the name the person and the model use for it. */
  readonly number: number;
  readonly createdAt: Date;
  /** The moment, in seconds of the source video (not of the export, which has the cuts taken out). */
  readonly sourceSec: number;
  /** Where on the frame it points, or null for a note on the moment alone. */
  readonly place: ReviewPlace | null;
  /** What was under it when it was made, innermost first. */
  readonly refs: ReadonlyArray<ReviewNoteRef>;
  /** The caption on screen when it was made, or null when none was. */
  readonly quote: string | null;
  readonly text: string;
  readonly status: ReviewNoteStatus;
  /** The batch it was sent in; null while it is a draft. */
  readonly batchId: string | null;
}
