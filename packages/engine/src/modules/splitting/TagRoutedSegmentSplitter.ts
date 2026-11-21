import type { SegmentSplitter } from '@modules/splitting/SegmentSplitter';
import type { TagRoute } from '@modules/splitting/TagRoute';
import type { Segment } from '@modules/document/Segment';

/**
 * Sends each segment through the splitter of the first route whose
 * condition holds over it, or through `fallback` when none does. A
 * condition is read over the tags of the whole segment, its own and its
 * words', so one matching word is enough. Segments keep their order.
 */
export class TagRoutedSegmentSplitter implements SegmentSplitter {
  constructor(
    private readonly routes: ReadonlyArray<TagRoute<SegmentSplitter>>,
    private readonly fallback: SegmentSplitter,
  ) {}

  split(segments: ReadonlyArray<Segment>): Segment[] {
    return segments.flatMap((segment) => this.splitterFor(segment).split([segment]));
  }

  private splitterFor(segment: Segment): SegmentSplitter {
    const tags = segment.getAllTags();
    return this.routes.find((route) => route.condition.evaluate(tags))?.splitter ?? this.fallback;
  }
}
