import type { GraphicTextLayout } from '@core/graphics/domain/GraphicTextLayout';
import type { GraphicMoment } from '@core/graphics/domain/GraphicMoment';

/**
 * One graphic, open and ready to be drawn at any time of its own: the
 * picture it shows a number of seconds after it opened. Times may be
 * asked in any order; the same time always gives the same picture.
 */
export interface GraphicPlayer {
  /** The moments the graphic's code declared as it ran, as it gave them; empty until it is ready. */
  readonly moments: ReadonlyArray<GraphicMoment>;
  /**
   * The picture the graphic shows `sec` seconds after it opened, at its
   * box's size, the caller's to draw and close. Rejects with
   * `GraphicFrameFailedError` when its code fails to draw it.
   */
  frameAt(sec: number): Promise<ImageBitmap>;
  /**
   * Which frame of the graphic's clock `sec` falls on: every time on
   * the same frame shows the same picture.
   */
  frameOf(sec: number): number;
  /**
   * How the text of the frame last drawn sat in its box; null before the
   * first frame, or when the player cannot measure text.
   */
  textLayout(): GraphicTextLayout | null;
  /** Closes the graphic; any picture still asked for is refused. Safe to call twice. */
  dispose(): void;
}
