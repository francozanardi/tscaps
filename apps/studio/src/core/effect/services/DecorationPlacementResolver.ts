import type { DecorationPlacementSide, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { EmojiPlacement } from '@core/effect/domain/EffectConfig';

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

  /**
   * Map keyed by decoration id with the side it should be lifted to.
   * Empty when the sheet keeps decorations inline. `position` is the
   * segment's place among the segments its sheet owns, counted from 0
   * in document order across the sheet's sections: `segment-around`
   * picks the side from it.
   */
  buildSegmentPlacements(sheet: Sheet, segment: Segment, position: number): Map<string, DecorationPlacementSide> {
    const out = new Map<string, DecorationPlacementSide>();
    const config = sheet.effectConfig('emoji');
    if (!config) return out;
    const side = this.sideOf(config.placement, position);
    if (side === null) return out;
    for (const line of segment.lines) {
      for (const word of line.words) {
        if (!word.decoration) continue;
        out.set(word.decoration.id, side);
      }
    }
    return out;
  }

  /**
   * The side the emojis of the segment at `position` are lifted to
   * under `placement`, or `null` when they stay inside their word.
   *
   * `segment-around` answers above or below by the segment's position,
   * so a segment keeps its side for as long as it keeps its place, and
   * the preview and the export agree on it.
   */
  sideOf(placement: EmojiPlacement, position: number): DecorationPlacementSide | null {
    if (placement === 'word') return null;
    if (placement === 'segment-above') return 'above';
    if (placement === 'segment-below') return 'below';
    return this.sideAround(position);
  }

  // A hash rather than alternating sides, which reads as a pattern within
  // a few segments, with constants picked for an irregular start, as a
  // short video only has a handful of segments; integer arithmetic, so
  // every JavaScript engine picks the same side for the same position.
  private sideAround(position: number): DecorationPlacementSide {
    let hash = Math.imul(position + 1, 0x9e3779b1);
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0xc2b2ae35);
    hash ^= hash >>> 13;
    return (hash >>> 0) % 2 === 0 ? 'above' : 'below';
  }
}
