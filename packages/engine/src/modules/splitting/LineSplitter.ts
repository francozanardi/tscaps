import type { Segment } from '@modules/document/Segment';

/**
 * Splits the words within each segment of a single Section into multiple
 * Line objects based on layout constraints. Receives the segments of one
 * Section and runs after SegmentSplitter and effects, before
 * StructureTagger, so a segment's `time` is already the one it is shown
 * for.
 */
export interface LineSplitter {
  split(segments: ReadonlyArray<Segment>): Segment[];
}
