import type { IsolatedWordPick, IsolatedWordSearchFrom } from '@tscaps/engine';

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
  /** Looser time on screen, tried only when no word reaches `minSecondsOnScreen`; absent means no second pass. */
  readonly fallbackMinSecondsOnScreen?: number;
  /** Tag expressions tried before the letters, in order; the first that finds a word picks it. */
  readonly tagPriority?: ReadonlyArray<string>;
  /** Which end of the caption the search starts from; absent means the end. */
  readonly searchFrom?: IsolatedWordSearchFrom;
  /** Whether the first word, or the only word of a caption, can stand alone too; absent means it cannot. */
  readonly allowFirstWord?: boolean;
  /** Fewest words a caption needs before any is lifted; absent means no floor. */
  readonly minSegmentWords?: number;
  /** Fewest characters every resulting line may hold; a word whose lifting leaves a shorter one is passed over. Absent means no floor. */
  readonly minLineChars?: number;
  /** Fewest plain captions between two with a lifted word; which ones lift is then chosen together, by how long their words take to say. Absent means none. */
  readonly minPlainSegmentsBetween?: number;
  /** Which qualifying word a caption lifts: the first in search order (default) or the one that takes longest to say. */
  readonly pickBy?: IsolatedWordPick;
  /** Whether only the caption's last word, and with `allowFirstWord` its first, can stand alone, in search order; absent means any word. */
  readonly onlyAtEnds?: boolean;
  /**
   * How unevenly, in em, a word's letters may end at its top or bottom and still have a line on that
   * side, measured in the lifted word's own font; a word past it at the top can only open the caption,
   * at the bottom only close it, at both only stand alone. Absent means the shape of a word does not matter.
   */
  readonly maxEdgeSpreadEm?: number;
}
