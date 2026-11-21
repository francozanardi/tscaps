/** A picture to show the model, with the line printed under it (a time, a name). */
export interface LabeledPicture {
  readonly bitmap: ImageBitmap;
  readonly label: string;
}

/** A region of a picture, in shares of its width and height (0 to 1). */
export interface PictureRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What is drawn behind a picture's transparent parts. */
export type PictureBackdrop = 'none' | 'checker';

/** A picture encoded for a model to read. */
export interface EncodedPicture {
  readonly mediaType: 'image/jpeg';
  readonly base64: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * Lays pictures out side by side, each with its label, in one image no
 * larger than asked: one image per call costs a model far fewer tokens
 * than one per picture. Pictures of different shapes each keep their
 * own, never stretched. The bitmaps are read, never closed.
 */
export interface PictureSheetComposer {
  sheet(
    pictures: ReadonlyArray<LabeledPicture>,
    options: { readonly maxWidthPx: number; readonly maxHeightPx: number; readonly region: PictureRegion | null; readonly backdrop: PictureBackdrop },
  ): Promise<EncodedPicture>;
}
