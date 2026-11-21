import type { SegmentSplitter } from '@modules/splitting/SegmentSplitter';
import type { TagCondition } from '@modules/tags/TagCondition';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';

/**
 * Splits each segment wherever the words stop or start matching a tag
 * condition, so every run of matching words becomes a segment of its
 * own, apart from the words around it. A word matches when the
 * condition holds over its own semantic tags. A segment whose words all
 * match, or none do, comes out as it went in.
 */
export class TagBoundarySegmentSplitter implements SegmentSplitter {
  constructor(private readonly condition: TagCondition) {}

  split(segments: ReadonlyArray<Segment>): Segment[] {
    return segments.flatMap((segment) => this.splitOne(segment));
  }

  private splitOne(segment: Segment): Segment[] {
    const runs = this.runsOf(segment.getWords());
    if (runs.length <= 1) return [segment];
    return runs.map((run) => new Segment({ lines: [new Line({ words: run })] }));
  }

  private runsOf(words: ReadonlyArray<Word>): Word[][] {
    const runs: Word[][] = [];
    let previous: boolean | null = null;
    for (const word of words) {
      const matches = this.condition.evaluate(word.semanticTags);
      if (matches === previous) runs[runs.length - 1]!.push(word);
      else runs.push([word]);
      previous = matches;
    }
    return runs;
  }
}
