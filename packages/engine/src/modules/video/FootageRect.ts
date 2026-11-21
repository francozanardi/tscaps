/**
 * A rectangle of the output frame in normalized coordinates: `0` is the
 * frame's left (or top) edge and `1` its right (or bottom) edge, on each
 * axis independently. A rect may reach past the frame; what falls
 * outside is not drawn.
 */
export interface FootageRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
