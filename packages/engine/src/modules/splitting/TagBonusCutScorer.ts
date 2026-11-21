import type { CutScorer } from '@modules/splitting/CutScorer';
import type { Word } from '@modules/document/Word';
import type { TagCondition } from '@modules/tags/TagCondition';

/**
 * Rates a cut as another scorer does, plus `weight` when the word before
 * it satisfies a tag condition: a run then breaks, where its bounds leave
 * a choice, right after the words it is told to end a piece on. Its own
 * bonus alone is a score, so a cut the inner scorer has no opinion on
 * still counts once the word before it matches.
 */
export class TagBonusCutScorer implements CutScorer {
  constructor(
    private readonly inner: CutScorer,
    private readonly condition: TagCondition,
    private readonly weight: number,
  ) {}

  scoreCutBefore(words: readonly Word[], index: number): number | null {
    const base = this.inner.scoreCutBefore(words, index);
    if (!this.condition.evaluate(words[index - 1]!.semanticTags)) return base;
    return (base ?? 0) + this.weight;
  }
}
