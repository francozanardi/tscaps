const MIN_FONT_SIZE_CQH = 1;
const MAX_FONT_SIZE_CQH = 25;

/**
 * Single source of truth for the font-size range the direct-
 * manipulation handles are allowed to push values to. Mirrors the
 * range the typography slider in the sidebar exposes, so a handle
 * drag can never land on a value the slider would refuse.
 */
export class FontSizeBounds {
  clamp(value: number): number {
    if (value < MIN_FONT_SIZE_CQH) return MIN_FONT_SIZE_CQH;
    if (value > MAX_FONT_SIZE_CQH) return MAX_FONT_SIZE_CQH;
    return value;
  }
}
