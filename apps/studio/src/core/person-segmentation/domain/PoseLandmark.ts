/**
 * Single body-part landmark produced by a pose detector. Coordinates
 * are normalised to `[0, 1]` over the input frame's dimensions.
 * `visibility` is the detector's confidence that the point is present
 * in the frame, normalised to `[0, 1]`; adapters at the detection
 * boundary substitute `1` when the underlying detector omits it.
 */
export interface PoseLandmark {
  readonly x: number;
  readonly y: number;
  readonly visibility: number;
}
