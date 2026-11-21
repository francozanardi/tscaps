import type { Word } from '@modules/document/Word';

/**
 * Rates a candidate cut between two consecutive words of a run.
 */
export interface CutScorer {
  /**
   * The case for cutting right before `words[index]`, higher being a
   * better cut, or null when nothing speaks for or against it.
   * `index` is between 1 and `words.length - 1`.
   */
  scoreCutBefore(words: readonly Word[], index: number): number | null;
}
