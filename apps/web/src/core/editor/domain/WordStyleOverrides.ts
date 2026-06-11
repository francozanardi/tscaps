import type { AlignmentConfig } from '@tscaps/engine';

/**
 * Per-word style overrides. Typography fields override the sheet's
 * typography; the position fields, when set, take the word out of its
 * segment's line flow and re-anchor it inside the video frame.
 *
 * A position commit writes all four anchor fields together
 * (`verticalAlign`, `verticalOffset`, `horizontalAlign`, `horizontalOffset`)
 * so a downstream change to the sheet's or segment's alignment does
 * not silently drag the detached word along — its frame-anchor stays
 * frozen at the user's chosen point.
 */
export interface WordStyleOverrides {
  readonly fontWeight?: number;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly strikethrough?: boolean;
  readonly fontFamily?: string;
  readonly fontSize?: number;
  readonly color?: string;
  readonly verticalAlign?: AlignmentConfig['verticalAlign'];
  /** Fraction of video height [0, 1]. */
  readonly verticalOffset?: number;
  readonly horizontalAlign?: AlignmentConfig['horizontalAlign'];
  /** Fraction of video width [0, 1]. */
  readonly horizontalOffset?: number;
  /** Degrees, [-180, 180]. Rotates this word's span around its own center. */
  readonly rotation?: number;
}
