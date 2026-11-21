import type { TimeFragment } from '@tscaps/engine';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';

/** What decides where other footage covers the video. */
export interface FootageCoverageInput {
  readonly shots: ShotPartition;
  readonly media: MediaAssetCatalog;
  readonly cuts: CutRegistry;
  /** How long the source video runs, or null when that is not known. */
  readonly videoDurationSec: number | null;
}

/** A stretch of the video other footage covers, and the layer that covers it. */
export interface FootageCover {
  readonly layerId: string;
  /** In source time. */
  readonly range: TimeFragment;
}

/**
 * Where other footage covers the video's own picture, whose actor is
 * then not on screen to put text behind.
 */
export interface FootageCoverage {
  /** Every covered stretch, one per layer that reaches the output. */
  covers(input: FootageCoverageInput): ReadonlyArray<FootageCover>;
}
