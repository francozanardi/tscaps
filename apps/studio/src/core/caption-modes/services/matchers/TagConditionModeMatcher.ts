import type { TagCondition, Word } from '@tscaps/engine';
import type { ModeMatcher } from '@core/caption-modes/domain/ModeMatcher';

/** Picks every word whose semantic tags a tag condition holds for. */
export class TagConditionModeMatcher implements ModeMatcher {
  constructor(private readonly condition: TagCondition) {}

  matchingWordIds(words: ReadonlyArray<Word>): ReadonlySet<string> {
    return new Set(words.filter((word) => this.condition.evaluate(word.semanticTags)).map((word) => word.id));
  }
}
