/**
 * The custom properties a layer's fields write — how it is laid out —
 * and that the framework builds its box from (`ShotLayerCss`): a layout
 * picked by number (`0` full screen, `1` split screen, `2` a box over
 * the video), and that layout's settings. Each is optional; one left out
 * takes the framework's default.
 *
 * A published contract: what a layer's CSS is written against, by the
 * animation library and by hand.
 */
export enum LayerCssVariable {
  /** `0` full screen, `1` split screen, `2` a box over the video. */
  LAYOUT = '--layer-layout',
  /** A length: the least space kept between the box and the frame's edges, or its part's in a split. */
  PADDING = '--layer-padding',
  /** In a split, which part the layer takes: `0` the top (or the left, on a horizontal frame), `1` the other. */
  SPLIT_SIDE = '--layer-split-side',
  /** In a split, the share of the frame's long side the layer's part takes. */
  SPLIT_RATIO = '--layer-split-ratio',
  /**
   * In a split, how the frame goes from whole to split as the layer
   * comes in: `0` at once, `1` the layer's part slides in with the line
   * dividing the frame, `2` the line uncovers the layer where it rests.
   * The part the video keeps follows the line either way.
   */
  SPLIT_ENTRANCE = '--layer-split-entrance',
  /** A time: how long the frame takes to split as the layer comes in; at most half the layer's own. */
  SPLIT_ENTRANCE_DURATION = '--layer-split-entrance-duration',
  /** In a split, how the frame goes back to whole as the layer leaves, numbered as `SPLIT_ENTRANCE` is. */
  SPLIT_EXIT = '--layer-split-exit',
  /** A time: how long the frame takes to be whole again as the layer leaves; at most half the layer's own. */
  SPLIT_EXIT_DURATION = '--layer-split-exit-duration',
  /** A box's centre, as a share of the frame's width and height. */
  CENTER_X = '--layer-center-x',
  CENTER_Y = '--layer-center-y',
  /** A box's width, as a share of the frame's width; shrunk where it would not fit inside the padding. */
  WIDTH = '--layer-width',
  /** A box's width over its height; the file's own where left out, or the video's where the video floats in it. */
  ASPECT_RATIO = '--layer-aspect-ratio',
  /**
   * On a box showing a layer's file filling a box of another shape,
   * which part of it the layout keeps, as a share of the part cropped
   * away (`0` the left or top edge, `0.5` the centre, `1` the right or
   * bottom edge): what the box shows while its camera places nothing of
   * its own, as the output frame's crop is for the video's own picture.
   */
  CROP_X = '--layer-crop-x',
  CROP_Y = '--layer-crop-y',
  /**
   * On a box showing a picture (the video's own, or a layer's file
   * filling its box), which part of it its camera keeps where it is
   * cropped, as a share of the part cropped away: `0` keeps the left
   * (or top) edge, `0.5` the centre, `1` the right (or bottom) edge.
   * Where left out, a pan's travel, else the layer's crop
   * (`CROP_X`, `_Y`), else the output frame's for the video's own
   * picture; the centre otherwise.
   */
  PICTURE_X = '--layer-picture-x',
  PICTURE_Y = '--layer-picture-y',
  /**
   * On a box showing the video's own picture, where its camera looks at
   * the end of its move, read as `PICTURE_X` and `_Y` are; each holds
   * where the box starts where left out.
   */
  PICTURE_END_X = '--layer-picture-end-x',
  PICTURE_END_Y = '--layer-picture-end-y',
  /**
   * The clock a camera preset is compiled against and listed under: a
   * name, never set on a box. A camera keeps time by itself (its own
   * duration, or the box's stretch), so it shares none of the clocks the
   * other parts of a layer's life are keyed by.
   */
  CAMERA_CLOCK = '--layer-camera-clock',
  /**
   * What fills a layer's box around its file where the file is fitted
   * inside it: `0` nothing, so what is beneath shows; `1` black; `2` the
   * file itself, blurred, covering the box.
   */
  BACKDROP = '--layer-backdrop',
  /** A length: how round the corners are of what floats in a box, or of the layer's part in a split. */
  CORNER_RADIUS = '--layer-corner-radius',
  /**
   * In a box, what floats in it: `0` the layer, over the video; `1` the
   * video, over the layer, which then fills the frame.
   */
  INSET_VIDEO = '--layer-inset-video',
  /**
   * In a box, how what floats in it comes in: `0` already in its box,
   * `1` from the whole frame, shrinking into its box.
   */
  INSET_ENTRANCE = '--layer-inset-entrance',
  /** A time: how long what floats takes to shrink into its box as the layer comes in; at most half the layer's own. */
  INSET_ENTRANCE_DURATION = '--layer-inset-entrance-duration',
  /** In a box, how what floats in it leaves, numbered as `INSET_ENTRANCE` is: `1` grows back to the whole frame. */
  INSET_EXIT = '--layer-inset-exit',
  /** A time: how long what floats takes to grow back to the whole frame as the layer leaves; at most half the layer's own. */
  INSET_EXIT_DURATION = '--layer-inset-exit-duration',
}
