import type { PersonSegmentationWindow } from '@core/person-segmentation/domain/PersonSegmentationWindow';
import type { MaskCache } from '@core/person-segmentation/domain/MaskCache';

/**
 * Aggregate detector output for one video: the set of time ranges the
 * scene meets the effect's criteria, plus the per-frame masks captured
 * inside those ranges. Together they carry everything preview + export
 * need to composite the text-behind-actor effect without re-running
 * the detector.
 */
export interface PersonSegmentationResult {
  readonly windows: ReadonlyArray<PersonSegmentationWindow>;
  readonly maskCache: MaskCache;
}
