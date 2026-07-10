/**
 * Cached actor cutout for a single timestamp. `alpha` holds the mask's
 * per-pixel opacity (0..255) row-major at the given `width` × `height`,
 * downsampled from the segmenter's native output. Consumers upsample
 * back to the composite resolution at draw time.
 */
export interface PersonSegmentationMask {
  readonly t: number;
  readonly alpha: Uint8Array;
  readonly width: number;
  readonly height: number;
}
