/**
 * Which side of the segment a decoration glyph should be lifted to
 * when the host sheet's effect config takes it out of line flow. When
 * a decoration id is absent from the placement map, the glyph stays
 * inline next to its host word.
 */
export type DecorationPlacementSide = 'above' | 'below';
