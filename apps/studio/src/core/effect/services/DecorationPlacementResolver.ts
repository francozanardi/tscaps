import type { DecorationPlacementSide, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';

/**
 * Decides which decorations a segment must lift out of line flow and
 * to which side of the segment they belong, based on the host sheet's
 * emoji effect config.
 *
 * Returns the side ('above' / 'below') for each decoration the sheet
 * promotes out of flow; decorations the sheet keeps inline ('word'
 * placement, or every decoration when the effect is disabled) are
 * omitted from the map. The caller is responsible for passing a
 * segment that already excludes decorations meant to stay hidden.
 */
export class DecorationPlacementResolver {

  /** Map keyed by decoration id with the side it should be lifted to. Empty when the sheet keeps decorations inline. */
  buildSegmentPlacements(sheet: Sheet, segment: Segment): Map<string, DecorationPlacementSide> {
    const out = new Map<string, DecorationPlacementSide>();
    const config = sheet.effectConfig('emoji');
    if (!config) return out;
    const placement = config.placement;
    if (placement === 'word') return out;
    const side: DecorationPlacementSide = placement === 'segment-above' ? 'above' : 'below';
    for (const line of segment.lines) {
      for (const word of line.words) {
        if (!word.decoration) continue;
        out.set(word.decoration.id, side);
      }
    }
    return out;
  }
}
