/**
 * The name every field answers to.
 *
 * An id is the key a value is recorded under, so it outlives the class
 * that emits the declaration and is read by code that has no reason to
 * know a field class exists — the font collector asking which face an
 * element was given, a migration writing values it will never render.
 * Spelled once here so those readers and the field cannot drift apart
 * in silence: a value recorded under a name nothing offers is a
 * declaration nobody can take back out.
 */
export enum ElementFieldId {
  ITALIC = 'italic',
  UNDERLINE = 'underline',
  STRIKETHROUGH = 'strikethrough',
  FONT_FAMILY = 'font-family',
  FONT_SIZE = 'font-size',
  RELATIVE_SIZE = 'relative-size',
  FONT_WEIGHT = 'font-weight',
  PRIMARY_COLOR = 'primary-color',
  ROTATION = 'rotation',
  LAYOUT = 'layout',
  FIT = 'fit',
  BACKDROP = 'backdrop',
  CORNER_RADIUS = 'corner-radius',
  PADDING = 'padding',
  SPLIT_SIDE = 'split-side',
  SPLIT_RATIO = 'split-ratio',
  SPLIT_ENTRANCE = 'split-entrance',
  SPLIT_ENTRANCE_DURATION = 'split-entrance-duration',
  SPLIT_EXIT = 'split-exit',
  SPLIT_EXIT_DURATION = 'split-exit-duration',
  CENTER_X = 'center-x',
  CENTER_Y = 'center-y',
  WIDTH = 'width',
  ASPECT_RATIO = 'aspect-ratio',
  CROP_X = 'crop-x',
  CROP_Y = 'crop-y',
  PICTURE_X = 'picture-x',
  PICTURE_Y = 'picture-y',
  PICTURE_END_X = 'picture-end-x',
  PICTURE_END_Y = 'picture-end-y',
  INSET_SUBJECT = 'inset-subject',
  INSET_ENTRANCE = 'inset-entrance',
  INSET_ENTRANCE_DURATION = 'inset-entrance-duration',
  INSET_EXIT = 'inset-exit',
  INSET_EXIT_DURATION = 'inset-exit-duration',
}
