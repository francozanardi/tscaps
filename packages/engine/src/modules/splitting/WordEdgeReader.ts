import type { Segment } from '@modules/document/Segment';
import type { Word } from '@modules/document/Word';

/**
 * How unevenly a word's letters end, as multiples of the font size it is
 * drawn at: at the top, the distance between its tallest letter and its
 * shortest, and at the bottom, between its deepest and its shallowest.
 * Small when every letter ends at the same height ("ounces" at both,
 * "red" at the bottom), large when one rises or drops past the rest
 * ("bounces" at the top, "money" at the bottom).
 */
export interface WordEdges {
  readonly topSpreadEm: number;
  readonly bottomSpreadEm: number;
}

/** Reads the edges of a word as it would be drawn lifted onto a line of its own in a segment. */
export interface WordEdgeReader {
  /** `null` when the word cannot be measured, in which case nothing should be concluded from its shape. */
  edgesOf(word: Word, segment: Segment): WordEdges | null;
}
