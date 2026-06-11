/**
 * Sheet-level rotation, applied as a single angle (degrees) on top of every
 * segment's positioning. Lives as its own slice — separate from
 * `AlignmentConfig` — because rotation is a post-positioning visual
 * transform, not part of the anchor math the engine renderer needs to lay
 * out a box. Keeping it apart preserves `AlignmentConfig` as a pure
 * "where does the anchor land" contract and leaves room for future
 * transform fields (pivot, skew, scale) without polluting alignment.
 *
 * Templates opt in by reading `--tscaps-rotation` in their `style.css`;
 * templates that omit the var are unaffected by the slider — the same
 * opt-in contract typography uses.
 */
export interface RotationConfig {
  /** Degrees, [-180, 180]. */
  readonly angleDeg: number;
}

export const ROTATION_DEFAULTS: RotationConfig = {
  angleDeg: 0,
};
