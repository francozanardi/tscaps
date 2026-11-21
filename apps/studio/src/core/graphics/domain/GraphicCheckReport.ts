import type { GraphicMessage } from '@core/graphics/domain/GraphicMessage';
import type { GraphicMoment } from '@core/graphics/domain/GraphicMoment';
import type { GraphicTextLayout } from '@core/graphics/domain/GraphicTextLayout';

/** The picture a checked graphic drew at one time, or why it drew none. */
export interface GraphicCheckFrame {
  /** The time drawn, in seconds since the graphic appears. */
  readonly sec: number;
  /**
   * The picture at the box's size, transparent where nothing is drawn;
   * null when it could not be drawn. Whoever holds the report closes it.
   */
  readonly bitmap: ImageBitmap | null;
  /** The share of the picture's pixels that are not fully transparent, from 0 to 1; 0 when there is no picture. */
  readonly drawnShare: number;
  /**
   * The share of the picture's pixels painted all but solid (an alpha of
   * at least 0.8), which hide what is under them, from 0 to 1; 0 when
   * there is no picture.
   */
  readonly paintedShare: number;
  /** Why there is no picture, or null when there is one. */
  readonly error: string | null;
  /** How its text sat in its box; null when there is no picture, or nothing measured it. */
  readonly text: GraphicTextLayout | null;
}

/**
 * What a graphic did when played once to be checked: whether it opened,
 * or why not; the box it was drawn in and how long it shows; its picture
 * at each time asked; what its code logged or threw, in order; and the
 * moments its code declared.
 */
export interface GraphicCheckReport {
  readonly opened: boolean;
  /** Why it did not open, or null when it did. */
  readonly openError: string | null;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly durationSec: number;
  /** One per distinct time asked, in order of time; empty when it did not open. */
  readonly frames: ReadonlyArray<GraphicCheckFrame>;
  readonly messages: ReadonlyArray<GraphicMessage>;
  readonly moments: ReadonlyArray<GraphicMoment>;
}
