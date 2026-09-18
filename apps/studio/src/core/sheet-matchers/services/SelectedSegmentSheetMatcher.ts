import type { Segment } from '@tscaps/engine';
import type { SegmentSheetMatcher } from '@core/sheet-matchers/domain/SheetMatcher';

/** Matches the explicit scene ids supplied by a transcript selection. */
export class SelectedSegmentSheetMatcher implements SegmentSheetMatcher<ReadonlySet<string>> {
  readonly granularity = 'segment' as const;

  matchesSegment(segment: Segment, segmentIds: ReadonlySet<string>): boolean {
    return segmentIds.has(segment.id);
  }
}
