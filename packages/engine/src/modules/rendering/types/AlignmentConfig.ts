export type VerticalAlign = 'top' | 'center' | 'bottom';
export type HorizontalAlign = 'left' | 'center' | 'right';

/**
 * Symmetric box-anchor positioning. `*Offset` is the absolute position of
 * the anchor point as a fraction of the video's dimensions; `*Align`
 * decides which edge of the caption box lands on that point:
 *   top/left   → 0% of own size
 *   center     → 50%
 *   bottom/right → 100%
 *
 * E.g. `verticalOffset: 1, verticalAlign: 'bottom'` pins the box's bottom
 * edge to the video's bottom edge. `horizontalOffset: 0.5,
 * horizontalAlign: 'center'` centers the box horizontally.
 */
export interface AlignmentConfig {
  verticalAlign: VerticalAlign;
  // Fraction of video height [0, 1].
  verticalOffset: number;
  horizontalAlign: HorizontalAlign;
  // Fraction of video width [0, 1].
  horizontalOffset: number;
}
