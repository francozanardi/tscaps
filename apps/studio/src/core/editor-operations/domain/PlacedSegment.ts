import type { Segment } from '@tscaps/engine';

/** A segment as it sits in the document: the segment and the sheet its section routes it to. */
export interface PlacedSegment {
  readonly segment: Segment;
  readonly sheetId: string;
}
