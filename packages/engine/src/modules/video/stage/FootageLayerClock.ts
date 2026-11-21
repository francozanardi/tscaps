import type { FootageLayer } from '@modules/video/FootageLayer';

/**
 * Puts a layer's box at a moment of the output: once set, what the
 * document computes for the box is how the layer looks at that moment.
 *
 * One clock serves the boxes of one stage, whose stylesheet does not
 * change while it does; it may keep what it learnt about a box between
 * moments.
 */
export interface FootageLayerClock {
  /**
   * Sets `box`, the box of `layer` on the stage, to `outputSec` of the
   * output timeline. Answers `still` where it knows the box computes to
   * exactly what it did the last time this clock set it, so whatever
   * was read off it then still holds; `moved` otherwise, and always the
   * first time a box is set.
   */
  set(box: HTMLElement, layer: FootageLayer, outputSec: number): FootageLayerClockChange;
}

/** What setting a box to a moment did to it: see {@link FootageLayerClock.set}. */
export type FootageLayerClockChange = 'moved' | 'still';
