/** Supported picker scripts, in the stable order used for shared glyph coverage. */
export const FONT_SCRIPTS = [
  'latin',
  'arabic',
  'hebrew',
  'urdu',
  'cyrillic',
  'greek',
  'devanagari',
  'bengali',
  'telugu',
  'tamil',
  'thai',
] as const;

export type FontScript = (typeof FONT_SCRIPTS)[number];

/** One shared font choice for every writing system the catalog does not manage. */
export const OTHER_FONT_FACE = 'other' as const;

export type FontFaceSlot = FontScript | typeof OTHER_FONT_FACE;
