/**
 * How a set of footage layers looks and moves, as CSS, the way a
 * caption style's stylesheet says how its captions do.
 *
 * The stylesheet is resolved on a stage of `frameWidth × frameHeight`
 * CSS pixels (`CssClass.FOOTAGE_STAGE`, a size container, so `cqw`,
 * `cqh` and `cqmin` are shares of the frame), holding one box per layer
 * (`CssClass.FOOTAGE_LAYER`) that carries the layer's `id` in
 * `DataAttribute.ELEMENT_ID`; the box of a layer showing the source's
 * own picture also carries `CssClass.FOOTAGE_SOURCE_PICTURE`. A box no rule places covers the frame.
 *
 * Every animation on a box is paused, and frozen to the moment drawn
 * through its delay, which reads the box's clock (`CssVariable`):
 * `--on-layer-starts` and `--on-layer-ends`, the moment the layer comes
 * onto the frame and the moment it leaves, in seconds relative to the
 * moment drawn, negative once past; and `--layer-duration`, how long it
 * stays.
 *
 * A stylesheet may read the clock anywhere, and resolves the same
 * wherever it does. One that reads it only where an animation takes its
 * delay, on its own or as what a `calc()` adds to or takes from, costs
 * far less a moment: its boxes are set by moving their animations
 * rather than by writing the clock anew, which leaves the rest of each
 * box's style alone.
 *
 * The stage's own rules come first, in the `CssLayer.FRAMEWORK` cascade
 * layer, so whatever the stylesheet writes, in that layer or one after
 * it, wins over them — except the pause, which is `!important`.
 *
 * What draws, read off each box once resolved:
 * - its layout box, relative to the stage, before any transform;
 * - `transform`, `translate`, `rotate` and `scale`, about its
 *   `transform-origin` (a turn out of the plane draws nothing);
 * - `opacity`, the radius of a `blur()` and the amount of a
 *   `brightness()` in `filter`, an `inset()` `clip-path`, the top-left
 *   `border-radius`, `object-fit` (`contain` and `scale-down` contain;
 *   anything else covers) and `object-position`;
 * - `background-color` and `--picture-fill-blur` (a length of the
 *   stage): what fills the box around a picture fitted inside it;
 * - `--clip-left`, `--clip-top`, `--clip-width`, `--clip-height` and
 *   `--clip-radius`, each a length of the stage: a rect the layer is
 *   cut to, its corners rounded;
 * - `--video-left`, `--video-top`, `--video-width` and `--video-height`,
 *   each a length of the stage: where the source's own picture is
 *   re-framed while the layer shows. All four, or the picture stays as
 *   it is, as it does where they cover the whole frame.
 *
 * Anything else draws nothing. A length written in pixels is a pixel of
 * the frame at `frameWidth × frameHeight`; whatever size the frame is
 * drawn at, the layer keeps its share of it.
 */
export interface FootageStyle {
  readonly css: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
}
