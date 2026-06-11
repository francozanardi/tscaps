import type { Segment } from '@modules/document/index';

/**
 * Splits the segments of a single Section into more granular Segments based
 * on layout constraints. Receives only the segments contained in one Section
 * and returns the new partition for that Section.
 */
export interface SegmentSplitter {
  split(segments: ReadonlyArray<Segment>): Segment[];
}
