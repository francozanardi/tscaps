/** A picture written as PNG, with the size it was written at. */
export interface EncodedPng {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly width: number;
  readonly height: number;
}

/** A part of a picture, each side a share of its width or height, 0 at the left or top. */
export interface PictureCrop {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Writes a picture, or a part of it, as PNG bytes, scaled down when it is larger than asked. */
export interface BitmapPngEncoder {
  /**
   * `crop` keeps only that part of the picture, clamped to it; null keeps it whole. `maxSidePx` bounds the
   * longer side of what is kept, keeping the aspect; null keeps the full size. Never scales up.
   */
  encode(bitmap: ImageBitmap, crop: PictureCrop | null, maxSidePx: number | null): Promise<EncodedPng>;
}
