/**
 * A conversion put to the reader before it starts, for a video this
 * browser cannot decode.
 */
export interface VideoConversionOffer {
  /** What the conversion is expected to take; `null` when the video could not be read for an estimate. */
  readonly estimatedSeconds: number | null;
}
