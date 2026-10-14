/** How an element composites against the picture beneath it. */
export type ElementBlendMode = 'difference';

/** Every blend mode an element can be given, for reading one back off something that was stored. */
export const ELEMENT_BLEND_MODES: ReadonlyArray<ElementBlendMode> = ['difference'];

/**
 * What an element does to the picture beneath it, as opposed to how it
 * looks on its own.
 *
 * Not a field: a field writes a declaration on the element, and an
 * effect cannot live there — a blend written on the element is cut off
 * by any ancestor a stylesheet turns into a stacking context. The
 * renderer paints the element apart and puts the effect on what paints
 * it instead (`ElementIsolation`).
 */
export interface ElementEffects {
  /** Absent paints the element over the picture as usual. */
  readonly blend?: ElementBlendMode;
}
