import type { Segment, TimeFragment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';

/**
 * Effective `customTime` for a decoration glyph. Returns `null` for
 * inline placement (the decoration inherits its host word's time);
 * returns the segment's time for above, below and around placement so the
 * decoration animates over the whole segment instead of one word's
 * narration slice.
 */
export class DecorationTimeResolver {
  resolve(sheet: Sheet, segment: Segment): TimeFragment | null {
    const placement = sheet.effectConfig('emoji')?.placement;
    if (placement === undefined || placement === 'word') return null;
    return segment.time;
  }
}
