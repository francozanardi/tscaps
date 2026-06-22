import type { Segment } from '@modules/document/Segment';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';

export interface RenderItem {
  seg: Segment;
  style: PreparedStyle;
  t: number;
  /** Zero-based position of `seg` inside its owning section, propagated to the subtree builder for `--segment-index`. */
  indexInSection: number;
}

export interface UniqueTile {
  items: RenderItem[];
  tileIndex: number;
}

export interface AssetGroup {
  assetKey: string;
  uniqueTiles: UniqueTile[];
}

export interface TileAssignment {
  assetKey: string;
  tileIndex: number;
}

/**
 * Output of the batch planner: one asset group per disjoint kind
 * combination at the timestamps in this batch, plus a per-timestamp
 * assignment naming the group and the tile within it. A `null`
 * assignment marks a timestamp with no active segment.
 */
export interface BatchPlan {
  groups: Map<string, AssetGroup>;
  assignments: Array<TileAssignment | null>;
}
