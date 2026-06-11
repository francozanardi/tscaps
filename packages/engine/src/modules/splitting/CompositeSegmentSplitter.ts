import type { SegmentSplitter } from '@modules/splitting/SegmentSplitter';
import type { Segment } from '@modules/document/Segment';

// Chains multiple SegmentSplitters in sequence. The output of each splitter
// is fed as input to the next.
export class CompositeSegmentSplitter implements SegmentSplitter {
  constructor(private readonly _splitters: ReadonlyArray<SegmentSplitter>) {}

  split(segments: ReadonlyArray<Segment>): Segment[] {
    return this._splitters.reduce<Segment[]>(
      (segs, splitter) => splitter.split(segs),
      [...segments],
    );
  }
}
