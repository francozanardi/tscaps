import type { TagCondition } from '@modules/tags/TagCondition';

/**
 * Where a segment goes when a tag condition holds over it: the
 * `splitter` that cuts or lays out the segments the `condition` picks.
 */
export interface TagRoute<TSplitter> {
  readonly condition: TagCondition;
  readonly splitter: TSplitter;
}
