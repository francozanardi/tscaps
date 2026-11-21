import type { ReviewPlace } from '@core/review-notes/domain/ReviewPlace';

/** A note's place and the number it is called by, to paint on a frame. */
export interface ReviewMarkedPlace {
  readonly place: ReviewPlace;
  readonly number: number;
}

/**
 * Paints what notes mark over a picture of the frame: each one's marks,
 * and its number where its comment hangs. Answers a new picture the
 * caller closes; `frame` is left as it was, still the caller's to close.
 */
export interface ReviewMarkPainter {
  paint(frame: ImageBitmap, marked: ReadonlyArray<ReviewMarkedPlace>): Promise<ImageBitmap>;
}
