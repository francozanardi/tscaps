/** How large a picture is, in pixels. */
export interface ImageDimensions {
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * Reads the size of a picture — a still image or the first frame of a
 * GIF — without keeping anything decoded. Rejects when the bytes are not
 * a picture this browser can read.
 */
export interface ImageDimensionsProbe {
  probe(image: Blob): Promise<ImageDimensions>;
}
