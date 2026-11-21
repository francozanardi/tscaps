/** A part of a picture, each side a share of its width or height (0 at the left or top edge). */
export interface PictureCrop {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}
