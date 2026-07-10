import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';

/**
 * Per-project persistence for a detector run's aggregate output —
 * scene-valid windows plus the per-frame actor masks captured inside
 * them. `load` resolves to `null` when no cached result is available;
 * a miss never triggers regeneration. Implementations may cap the
 * number of stored entries and evict on LRU.
 */
export interface PersonSegmentationCacheRepository {
  load(projectId: string): Promise<PersonSegmentationResult | null>;
  store(projectId: string, result: PersonSegmentationResult): Promise<void>;
  delete(projectId: string): Promise<void>;
}
