/**
 * How a caption layer is composited onto what lies beneath it.
 *
 * The values are the blend modes CSS (`mix-blend-mode`) and the 2D
 * canvas (`globalCompositeOperation`) share under the same names, so a
 * layer composited in a canvas paints what the same subtree would with
 * the property written on its root in a page. `NORMAL` is plain
 * source-over.
 */
export enum CaptionBlendMode {
  NORMAL = 'normal',
  MULTIPLY = 'multiply',
  SCREEN = 'screen',
  OVERLAY = 'overlay',
  DARKEN = 'darken',
  LIGHTEN = 'lighten',
  COLOR_DODGE = 'color-dodge',
  COLOR_BURN = 'color-burn',
  HARD_LIGHT = 'hard-light',
  SOFT_LIGHT = 'soft-light',
  DIFFERENCE = 'difference',
  EXCLUSION = 'exclusion',
  HUE = 'hue',
  SATURATION = 'saturation',
  COLOR = 'color',
  LUMINOSITY = 'luminosity',
}
