import type { EncodedPicture } from '@core/pictures/domain/PictureSheetComposer';
import type { PicturePoint } from '@core/reframe/domain/PicturePoint';

/** A person marked on a picture: their letter and a box around their head, `headHeight` tall as a share of the picture's height. */
export interface HeadMark {
  readonly letter: string;
  readonly head: PicturePoint;
  readonly headHeight: number;
}

/** A whole picture of the source with its label and the people marked on it. */
export interface MarkedPicture {
  readonly bitmap: ImageBitmap;
  readonly label: string;
  readonly marks: ReadonlyArray<HeadMark>;
}

/**
 * Draws the pictures a subject is chosen from, encoded for a model to
 * read. The bitmaps are read, never closed.
 */
export interface SurveySheetComposer {
  /**
   * Pictures in rows of `columns`, each `cellWidthPx` wide and labelled,
   * every marked person boxed at the head with their letter beside it,
   * and a ruler along the bottom edge numbering the tenths of the
   * picture's width, to read a point across it.
   */
  survey(pictures: ReadonlyArray<MarkedPicture>, columns: number, cellWidthPx: number): Promise<EncodedPicture>;
}
