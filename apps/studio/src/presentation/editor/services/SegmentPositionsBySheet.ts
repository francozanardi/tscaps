/**
 * Per-sheet ordinal position of every segment that sheet owns in the
 * document. Returned to the overlay so segment-indexed template
 * recipes (e.g. alternating-color rows) can look up their own
 * position without scanning the document themselves.
 */
export class SegmentPositionsBySheet {
  constructor(private readonly positions: Map<string, Map<string, number>>) {}

  positionOf(sheetId: string, segmentId: string): number {
    return this.positions.get(sheetId)?.get(segmentId) ?? 0;
  }
}
