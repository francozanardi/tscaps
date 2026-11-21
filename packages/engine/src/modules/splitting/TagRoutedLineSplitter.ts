import type { LineSplitter } from '@modules/splitting/LineSplitter';
import type { TagRoute } from '@modules/splitting/TagRoute';
import type { Segment } from '@modules/document/Segment';

/**
 * Lays out each segment's lines with the splitter of the first route
 * whose condition holds over it, or with `fallback` when none does. A
 * condition is read over the tags of the whole segment, its own and its
 * words'. Consecutive segments going the same way are handed over
 * together, so a splitter that weighs a segment against its neighbours
 * still sees them; segments keep their order.
 */
export class TagRoutedLineSplitter implements LineSplitter {
  constructor(
    private readonly routes: ReadonlyArray<TagRoute<LineSplitter>>,
    private readonly fallback: LineSplitter,
  ) {}

  split(segments: ReadonlyArray<Segment>): Segment[] {
    return this.groupsOf(segments).flatMap((group) => group.splitter.split(group.segments));
  }

  private groupsOf(segments: ReadonlyArray<Segment>): Array<{ splitter: LineSplitter; segments: Segment[] }> {
    const groups: Array<{ splitter: LineSplitter; segments: Segment[] }> = [];
    for (const segment of segments) {
      const splitter = this.splitterFor(segment);
      const last = groups[groups.length - 1];
      if (last && last.splitter === splitter) last.segments.push(segment);
      else groups.push({ splitter, segments: [segment] });
    }
    return groups;
  }

  private splitterFor(segment: Segment): LineSplitter {
    const tags = segment.getAllTags();
    return this.routes.find((route) => route.condition.evaluate(tags))?.splitter ?? this.fallback;
  }
}
