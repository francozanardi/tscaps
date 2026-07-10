// Tagged union of every supported line splitter config.
export type LineSplitterConfig =
  | BalancedLineSplitterConfig
  | BalancedPixelWidthLineSplitterConfig
  | FixedTailLineSplitterConfig;

export interface BalancedLineSplitterConfig {
  readonly type: 'balanced';
  readonly maxLines: number;
  readonly minLines: number;
  readonly maxCharsPerLine: number;
}

export interface BalancedPixelWidthLineSplitterConfig {
  readonly type: 'balanced-pixel-width';
  readonly maxLines: number;
  readonly minLines: number;
  /** Fraction of the video width used as the max line width (e.g. 0.8 = 80%). */
  readonly maxWidthRatio: number;
}

export interface FixedTailLineSplitterConfig {
  readonly type: 'fixed-tail';
  /** Word count reserved for the second line when the segment has more words than this. */
  readonly tailWordCount: number;
}
