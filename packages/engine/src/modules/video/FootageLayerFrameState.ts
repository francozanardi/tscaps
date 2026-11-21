import type { FootageRect } from '@modules/video/FootageRect';

/**
 * How a picture is scaled into its rect: `cover` fills the rect,
 * cropping whatever falls outside; `contain` shows the whole picture,
 * leaving the rest of the rect empty. Where it sits is its position.
 */
export type FootageFit = 'cover' | 'contain';

/**
 * Where a picture sits in its asset rect along one axis, the way
 * `object-position` places it: `share` of the room the rect leaves
 * around the picture (the rect's length less the picture's, negative
 * where a covering picture reaches past it), then moved by `offset`, a
 * fraction of the frame along that axis. `{ share: 0.5, offset: 0 }`
 * centres it; `{ share: 0, offset: 0 }` puts it against the rect's
 * left (or top) edge.
 */
export interface FootageAxisPosition {
  readonly share: number;
  readonly offset: number;
}

/** Where a picture sits in its asset rect, on each axis. */
export interface FootagePosition {
  readonly x: FootageAxisPosition;
  readonly y: FootageAxisPosition;
}

/**
 * How much of a layer is hidden from each side, in fractions of its
 * asset rect: `left: 0.25` hides its left quarter. The hidden part
 * moves, scales and turns with the layer.
 */
export interface FootageClipInset {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * A 2D affine transform applied about the centre of a layer's asset
 * rect, its six values read as `DOMMatrix` reads them: a point `(x, y)`
 * relative to that centre lands at `(a·x + c·y + e, b·x + d·y + f)`.
 *
 * `a`, `b`, `c` and `d` carry no unit — they turn, scale and skew, and
 * mean the same at any size of the frame. `e` and `f` move the layer by
 * fractions of the frame's width and height. The identity is
 * `{ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }`.
 */
export interface FootageTransform {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

/**
 * Everything about how one layer is drawn on one output frame.
 *
 * The footage is drawn into `assetRect` with `fit`, placed in it at
 * `position`, its corners rounded
 * by `cornerRadius` — a fraction of the frame's shorter side, `0` for
 * square corners, never more than half the shorter side of what shows.
 * It is drawn at `opacity` (0 to 1), moved by `transform` about the
 * rect's centre, softened by a `blur` radius in fractions of the frame's
 * shorter side, and cut by `clipInset`; the clip, the rounded corners
 * and the picture move together.
 *
 * With a `videoRect`, the source's own picture is re-framed to cover
 * that rect and the rest of the frame is black before any layer is
 * drawn; with none, the source's picture stays as it is underneath.
 * With `videoAbove`, the source's picture is drawn instead over this
 * layer, re-framed to cover its `videoRect` with its corners rounded by
 * `videoCornerRadius` (a fraction of the frame's shorter side), and
 * nothing of it is drawn beneath: the frame beneath every layer is
 * black. Where more than one layer drawn at a moment carries a
 * `videoRect`, the topmost of them is the one applied. The `videoRect` takes none of the
 * layer's transform, clip or fade; it changes from one moment to the
 * next only where the style animates it.
 *
 * It is what a layer's `FootageStyle` resolves to at one moment, as a
 * `FootageLayerResolver` answers it.
 */
export interface FootageLayerFrameState {
  readonly assetRect: FootageRect;
  readonly fit: FootageFit;
  readonly position: FootagePosition;
  readonly cornerRadius: number;
  readonly opacity: number;
  readonly transform: FootageTransform;
  readonly blur: number;
  /** How bright it is drawn, as `brightness()` reads: 1 as it is, 0 black, past 1 brighter. */
  readonly brightness: number;
  readonly clipInset: FootageClipInset;
  readonly videoRect: FootageRect | null;
  /** Whether the source's picture is drawn over this layer, in `videoRect`, rather than beneath every layer. */
  readonly videoAbove: boolean;
  /** How round the corners of `videoRect` are where the picture is drawn over the layer, as `cornerRadius` reads. */
  readonly videoCornerRadius: number;
  /**
   * The colour its box is filled with, as CSS computes it, or null where
   * it has none. A backdrop layer is drawn over it, in place of black;
   * any other layer's box is filled with it beneath a picture fitted
   * inside it (`contain`), so the box shows whole around the picture.
   */
  readonly backgroundColor: string | null;
  /**
   * The radius, in fractions of the frame's shorter side, of a blurred
   * copy of the layer's own picture covering its box beneath a picture
   * fitted inside it (`contain`), over the background colour if any;
   * `0` for none.
   */
  readonly fillBlur: number;
  /**
   * A rect of the frame nothing of the layer is drawn outside, its
   * corners rounded by `clipRadius` (a fraction of the frame's shorter
   * side); null where the layer is not cut. It takes the layer's
   * transform and fade, as the layer's own clip does: a box grown past
   * it shows only what falls inside.
   */
  readonly clipRect: FootageRect | null;
  readonly clipRadius: number;
}
