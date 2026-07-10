/**
 * Sub-region of a frame expressed as fractions of the frame's width
 * and height. All coordinates live in `[0, 1]` and satisfy
 * `minX <= maxX` and `minY <= maxY`.
 */
export interface NormalizedBbox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}
