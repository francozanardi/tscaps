/**
 * One opening of a {@link FootagePictureProvider}'s pictures.
 *
 * `width × height` is the pictures' full size, in pixels, known before
 * the first one is asked: what a picture is laid out against wherever
 * it is drawn. An opening asked for a smaller scale hands over bitmaps
 * of fewer pixels, each standing for that same size.
 */
export interface ProvidedFootagePictures {
  readonly width: number;
  readonly height: number;

  /**
   * The picture at `sourceSec` of the layer's own time, which starts at
   * 0 where its stretch starts. The bitmap is handed over: the receiver
   * closes it. Moments are asked in any order. Rejects when that moment
   * cannot be drawn.
   */
  pictureAt(sourceSec: number): Promise<ImageBitmap>;

  /**
   * Which of its pictures is drawn at `sourceSec`: a number that is the
   * same for every time drawing the same picture, and for no other.
   * Pictures that step at a rate of their own answer the step; pictures
   * that differ at every time answer the time. A picture still held for
   * the number asked is not asked for again.
   */
  frameOf(sourceSec: number): number;

  /** Lets go of what drawing the pictures holds. Nothing is asked after. */
  close(): void;
}
