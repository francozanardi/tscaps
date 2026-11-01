/**
 * A conversion put to the reader before it starts, for a video this
 * browser cannot decode.
 */
export interface VideoConversionOffer {
  /** What the conversion is expected to take; `null` when the video could not be read for an estimate. */
  readonly estimatedSeconds: number | null;
  /**
   * `true` when this browser is expected to need several GB of memory
   * for it, enough to close the tab on a computer with little memory.
   */
  readonly memoryHeavy: boolean;
}
