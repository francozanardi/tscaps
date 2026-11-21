import type { ReviewNote } from '@core/review-notes/domain/ReviewNote';
import type { ReviewNoteRefReading } from '@core/review-notes/domain/ReviewNoteRefReading';

/** A ref of a note, as its reader names it, and what it points at now. */
export interface NamedReviewNoteRef {
  readonly name: string;
  readonly reading: ReviewNoteRefReading;
}

/** A note and what the project says about it now, for writing it down. */
export interface ReviewNoteFacts {
  readonly note: ReviewNote;
  /** Where its moment lands in the export, the cuts taken out; null when its moment is cut away. */
  readonly outputSec: number | null;
  readonly refs: ReadonlyArray<NamedReviewNoteRef>;
  /** Whether a picture of its place goes with the text. */
  readonly pictured: boolean;
  /** Whether the frame's aspect changed since it was made, so its place may point elsewhere now. */
  readonly aspectChanged: boolean;
}
