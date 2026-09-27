// Tagged union of every supported line splitter config.
export type LineSplitterConfig =
  | BalancedLineSplitterConfig
  | BalancedPixelWidthLineSplitterConfig
  | FixedTailLineSplitterConfig
  | IsolatedWordLineSplitterConfig;

export interface BalancedLineSplitterConfig {
  readonly type: 'balanced';
  readonly maxLines: number;
  readonly minLines: number;
  readonly maxCharsPerLine: number;
  /** Shortest line a break may produce; a split under it falls back to one line fewer. */
  readonly minCharsPerLine: number;
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
  /** Fewest words a segment needs before it is split; absent means 3. */
  readonly minWordsToSplit?: number;
}

export interface IsolatedWordLineSplitterConfig {
  readonly type: 'isolated-word';
  /** Fewest letters a word needs to stand on a line of its own. */
  readonly minLetters: number;
  /** Least seconds a word stays on screen, from when it is said until its caption leaves, to stand alone. */
  readonly minSecondsOnScreen: number;
}
