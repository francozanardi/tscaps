/**
 * Where a graphic is meant to sit on the frame: over all of it, or in a
 * box of the graphic's own shape, its centre and width shares of the
 * frame (0 is the left or top edge, 1 the right or bottom).
 */
export type GraphicBox =
  | { readonly kind: 'full' }
  | { readonly kind: 'box'; readonly centerX: number; readonly centerY: number; readonly width: number };
