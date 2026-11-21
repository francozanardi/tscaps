import type { ReviewNoteRef } from '@core/review-notes/domain/ReviewNoteRef';

/** One moment's frame, with the places of every note at that moment painted over it. */
export interface ReviewNotePicture {
  /** The moment, in seconds of the source video. */
  readonly sourceSec: number;
  /** The notes it shows, in the order they were made. */
  readonly numbers: ReadonlyArray<number>;
  /** The output frame at its full size, the notes' marks over it. The receiver closes it. */
  readonly bitmap: ImageBitmap;
}

/** Notes as a model reads them: what they say, and pictures of the places they mark. */
export interface ReviewNotesReading {
  readonly text: string;
  /** One per moment of a note with a place, when it could be drawn, earliest first. */
  readonly pictures: ReadonlyArray<ReviewNotePicture>;
}

/** How the reader of the notes names a ref; `kind:id` with the editor's ids when not given. */
export type ReviewNoteRefNaming = (ref: ReviewNoteRef) => string;
