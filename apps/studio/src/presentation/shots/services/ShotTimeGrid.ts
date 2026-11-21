// A hundredth of a second: finer than a frame at 60 fps, and the
// precision the transcript's own time sliders drag at.
const STEPS_PER_SEC = 100;
// How far past a point of the grid a value can sit and still count as
// on it: the sum of two hundredths in floating point lands a hair off.
const ON_GRID_TOLERANCE_STEPS = 1e-6;

/**
 * The precision a shot's times are edited at — where a shot opens and
 * ends, and which part of its b-roll's file plays — counted from zero.
 *
 * A slider steps from its minimum and its typed value snaps from there
 * too, so a minimum off the grid moves every value with it: a range
 * whose ends are on the grid is what lets 1.63 stay 1.63. Values come
 * back as the nearest double to the decimal, never with the noise the
 * arithmetic of stepping leaves.
 */
export class ShotTimeGrid {
  /** One step of the grid, in seconds. */
  readonly stepSec = 1 / STEPS_PER_SEC;

  /** The point of the grid nearest `sec`. */
  snap(sec: number): number {
    return Math.round(sec * STEPS_PER_SEC) / STEPS_PER_SEC;
  }

  /** The first point of the grid at or above `sec`. */
  ceil(sec: number): number {
    return Math.ceil(sec * STEPS_PER_SEC - ON_GRID_TOLERANCE_STEPS) / STEPS_PER_SEC;
  }

  /** The last point of the grid at or below `sec`. */
  floor(sec: number): number {
    return Math.floor(sec * STEPS_PER_SEC + ON_GRID_TOLERANCE_STEPS) / STEPS_PER_SEC;
  }
}
