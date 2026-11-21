import type { ReviewNoteRef } from '@core/review-notes/domain/ReviewNoteRef';
import type { ReviewPlace } from '@core/review-notes/domain/ReviewPlace';

/** What the person said and where, before it becomes a note. */
export interface ReviewNoteDraft {
  /** The moment, in seconds of the source video. */
  readonly sourceSec: number;
  readonly place: ReviewPlace | null;
  readonly refs: ReadonlyArray<ReviewNoteRef>;
  /** The caption on screen at that moment, or null when none is. */
  readonly quote: string | null;
  readonly text: string;
}
