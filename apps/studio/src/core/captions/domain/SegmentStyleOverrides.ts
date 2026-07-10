/**
 * Per-segment style overrides. Mirrors `WordStyleOverrides` for typography
 * fields and adds two optional position offsets that, when set, replace the
 * sheet's `verticalOffset` / `horizontalOffset` for this segment only.
 *
 * The sheet's alignment anchor is intentionally not overridable — it stays
 * inherited from the sheet so the user only adjusts where the segment sits,
 * not the box-anchor semantics.
 */
export interface SegmentStyleOverrides {
  readonly fontWeight?: number;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly strikethrough?: boolean;
  readonly fontFamily?: string;
  readonly fontSize?: number;
  readonly color?: string;
  /** Fraction of video height [0, 1]. */
  readonly verticalOffset?: number;
  /** Fraction of video width [0, 1]. */
  readonly horizontalOffset?: number;
  /** Degrees, [-180, 180]. Replaces the sheet's rotation for this segment only. */
  readonly rotation?: number;
}
