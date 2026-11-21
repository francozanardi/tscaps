/** A value a graphic's field holds, handed to its code as is. */
export type GraphicParamValue = string | number | boolean;

/**
 * What a graphic is played on: the size of its box on the output, which
 * is its whole viewport, the frame rate its clock steps at, the seed its
 * randomness starts from, how long it shows, and its fields' values.
 */
export interface GraphicStage {
  /** The box's width on the output, in pixels. */
  readonly widthPx: number;
  /** The box's height on the output, in pixels. */
  readonly heightPx: number;
  /** Frames per second its clock steps at; a time asked is rounded to the nearest of its frames. */
  readonly fps: number;
  /** Where its randomness starts, so the same graphic draws the same thing every time. */
  readonly seed: number;
  /** How long it shows, in seconds. */
  readonly durationSec: number;
  readonly params: Readonly<Record<string, GraphicParamValue>>;
}
