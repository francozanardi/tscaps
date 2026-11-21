/**
 * The names a shot layer's CSS is written against, besides the engine's
 * (its stage and box classes, its clock and the `--video-*` lengths it
 * reads, `CssClass` and `CssVariable`) and its layout's settings
 * (`LayerCssVariable`): published, so a layer's CSS written by hand or
 * by the animation library can rely on them.
 */
export enum ShotLayerCss {
  /**
   * Where a box rests, as lengths of the stage: built by the framework
   * from the layer's layout, which places the box from them. A motion
   * travelling just out of the frame reads them to know how far that is.
   */
  BOX_LEFT = '--layer-box-left',
  BOX_TOP = '--layer-box-top',
  BOX_WIDTH = '--layer-box-width',
  BOX_HEIGHT = '--layer-box-height',
  /**
   * The `animation` shorthands an entrance and an exit publish, which
   * the framework plays together.
   */
  ENTRANCE_ANIMATION = '--layer-entrance-animation',
  EXIT_ANIMATION = '--layer-exit-animation',
  /**
   * A box's camera move, as an `animation` shorthand the framework plays
   * beside the others, set by a camera preset: on the box showing a
   * shot's own video, or on a layer's, whose picture moves inside its
   * layout's box.
   */
  CAMERA_ANIMATION = '--layer-camera-animation',
  /** The file's width over its height, the shape a box takes when its layout names none. */
  ASSET_ASPECT_RATIO = '--layer-asset-aspect-ratio',
  /** `1` on a frame wider than it is tall, where a split cuts left and right; `0` otherwise. */
  FRAME_LANDSCAPE = '--layer-frame-landscape',
  /** The frame's width over its height: the shape the video takes where it floats in a box. */
  FRAME_ASPECT_RATIO = '--layer-frame-aspect-ratio',
  /** The cascade layer each box's file facts land in, between the framework's and the element's. */
  ASSET_LAYER = 'tscaps-layer-asset',
  /** The cascade layer each layer's own CSS lands in, after the file's. */
  ELEMENT_LAYER = 'tscaps-element',
  /**
   * The cascade layer the cameras that follow a person land in, after
   * the element's: a shot following someone is framed by the person,
   * whatever its own CSS places.
   */
  FOLLOW_LAYER = 'tscaps-shot-follow',
  /** The cascade layer the transitions between shots land in, last: no layer's own CSS reaches them. */
  TRANSITION_LAYER = 'tscaps-shot-transition',
}
