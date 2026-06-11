// Open base contract for every segment splitter config: only the `type`
// discriminator is required. Consumers define concrete variants by
// extending this. Templates declare their pipeline as an ordered array
// of configs; the deriver composes them in declared order.
export interface SegmentSplitterConfig {
  readonly type: string;
}

export interface LimitByCharsSegmentConfig extends SegmentSplitterConfig {
  readonly type: 'limit_by_chars';
  readonly maxChars: number;
  readonly minChars: number;
  readonly minDuration: number;
  readonly minLastWordDuration: number;
}

export interface LimitByWordsSegmentConfig extends SegmentSplitterConfig {
  readonly type: 'limit_by_words';
  readonly maxWords: number;
}

export interface LimitByScaledCharsSegmentConfig extends SegmentSplitterConfig {
  readonly type: 'limit_by_scaled_chars';
  readonly maxChars: number;
  readonly minChars: number;
}

/**
 * Splits at hard boundary characters (sentence-ending punctuation, optional
 * clause separators). Modes resolve to a set of "do not merge across" chars:
 *   - none    : no boundaries; words flow freely into the next splitter
 *   - sentence: end-of-sentence punctuation
 *   - clause  : sentence boundaries plus intra-sentence punctuation (, ; :)
 *   - custom  : caller-specified chars, optionally extending a preset
 */
export type BoundaryPreset = 'none' | 'sentence' | 'clause';

export type BoundarySegmentConfig = SegmentSplitterConfig &
  ({ readonly type: 'boundary'; readonly mode: 'none' | 'sentence' | 'clause' }
   | { readonly type: 'boundary'; readonly mode: 'custom'; readonly extends?: BoundaryPreset; readonly chars: readonly string[] });

export interface PauseBasedSegmentConfig extends SegmentSplitterConfig {
  readonly type: 'pause_based';
  readonly minGap: number;
}
