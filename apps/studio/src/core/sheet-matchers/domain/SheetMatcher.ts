import type { Segment, Word } from '@tscaps/engine';

/**
 * What a matcher run moved: segments for a segment-granularity matcher
 * and words for a word-granularity one, so the caller can phrase the
 * outcome in the right unit.
 */
export interface SheetMatcherRunResult {
  readonly movedCount: number;
}

/**
 * A matcher that assigns whole segments: every segment it says yes to
 * moves to the target sheet as-is.
 */
export interface SegmentSheetMatcher<TParams> {
  readonly granularity: 'segment';
  matchesSegment(segment: Segment, params: TParams): boolean;
}

/**
 * A matcher that extracts words: contiguous runs of matching words are
 * carved out of their segments and moved to the target sheet, while the
 * surrounding words stay behind under their original sheet.
 */
export interface WordSheetMatcher<TParams> {
  readonly granularity: 'word';
  matchesWord(word: Word, params: TParams): boolean;
}

/**
 * One strategy for picking the content that belongs on a sheet. Lives as
 * a singleton; the match method is parameterised so a caller builds a
 * fresh call without instantiating a new matcher per gesture.
 */
export type SheetMatcher<TParams> = SegmentSheetMatcher<TParams> | WordSheetMatcher<TParams>;
