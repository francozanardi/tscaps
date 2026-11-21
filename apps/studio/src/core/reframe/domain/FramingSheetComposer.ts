import type { EncodedPicture } from '@core/pictures/domain/PictureSheetComposer';
import type { PictureCrop } from '@core/reframe/domain/PictureCrop';

/** A picture with the label drawn on its top left corner. */
export interface LabelledPicture {
  readonly bitmap: ImageBitmap;
  readonly label: string;
}

/**
 * Draws the pictures a framing is chosen from, each one encoded for a
 * model to read. The bitmaps are read, never closed.
 */
export interface FramingSheetComposer {
  /**
   * One row per picture (moments of one take), one column per crop, each
   * column showing the same part of every picture at the crop's own
   * shape and labelled with its letter: what the viewer would see.
   */
  crops(
    pictures: ReadonlyArray<ImageBitmap>,
    crops: ReadonlyArray<PictureCrop>,
    letters: ReadonlyArray<string>,
    cellHeightPx: number,
  ): Promise<EncodedPicture>;
  /** Pictures in rows of `columns`, each `cellWidthPx` wide and labelled. */
  grid(pictures: ReadonlyArray<LabelledPicture>, columns: number, cellWidthPx: number): Promise<EncodedPicture>;
}
