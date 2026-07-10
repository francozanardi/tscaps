/**
 * Single-channel grayscale image the detector's motion and blur
 * calculators consume. Pixel data is row-major, one byte per pixel
 * in `[0, 255]`, at the stated `width` × `height`.
 */
export interface GrayscaleFrame {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
}
