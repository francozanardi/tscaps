import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import type { PersonSegmentationMask } from '@core/person-segmentation/domain/PersonSegmentationMask';
import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import type { PersonSegmentationWindow } from '@core/person-segmentation/domain/PersonSegmentationWindow';

const STORE = 'person-segmentation-cache';

interface PersonSegmentationCacheRecord {
  readonly projectId: string;
  readonly windows: ReadonlyArray<PersonSegmentationWindow>;
  readonly masks: ReadonlyArray<PersonSegmentationMask>;
  lastAccessed: number;
}

/**
 * `PersonSegmentationCacheRepository` backed by the shared
 * `person-segmentation-cache` IndexedDB store. Serialises the mask
 * cache as an ordered array of `{ t, alpha, width, height }` records
 * inside a single per-project entry; IndexedDB's structured clone
 * carries the `Uint8Array` alpha bytes without an explicit encoding
 * step.
 *
 * The number of stored projects is capped by `maxCachedProjects` and
 * enforced via LRU eviction on `lastAccessed`. Refreshing a project's
 * own entry never evicts another project.
 */
export class IndexedDbPersonSegmentationCacheRepository implements PersonSegmentationCacheRepository {
  constructor(
    private readonly db: IndexedDbClient,
    private readonly maxCachedProjects: number,
  ) {}

  async load(projectId: string): Promise<PersonSegmentationResult | null> {
    const record = await this.db.readOne<PersonSegmentationCacheRecord>(STORE, projectId);
    if (!record) return null;
    await this.touch(record);
    return this.toResult(record);
  }

  async store(projectId: string, result: PersonSegmentationResult): Promise<void> {
    await this.evictIfNeeded(projectId);
    const record: PersonSegmentationCacheRecord = {
      projectId,
      windows: result.windows,
      masks: result.maskCache.toArray(),
      lastAccessed: Date.now(),
    };
    await this.db.writeOne(STORE, record);
  }

  async delete(projectId: string): Promise<void> {
    await this.db.deleteOne(STORE, projectId);
  }

  private toResult(record: PersonSegmentationCacheRecord): PersonSegmentationResult {
    const maskCache = new MaskCache();
    for (const mask of record.masks) maskCache.add(mask);
    return { windows: record.windows, maskCache };
  }

  private async touch(record: PersonSegmentationCacheRecord): Promise<void> {
    record.lastAccessed = Date.now();
    await this.db.writeOne(STORE, record);
  }

  private async evictIfNeeded(incomingId: string): Promise<void> {
    const all = await this.db.readAll<PersonSegmentationCacheRecord>(STORE);
    const isReplacement = all.some((record) => record.projectId === incomingId);
    const projectedSize = isReplacement ? all.length : all.length + 1;
    if (projectedSize <= this.maxCachedProjects) return;
    const victim = this.pickEvictionVictim(all, incomingId);
    if (victim) await this.delete(victim.projectId);
  }

  private pickEvictionVictim(all: PersonSegmentationCacheRecord[], incomingId: string): PersonSegmentationCacheRecord | null {
    const candidates = all
      .filter((record) => record.projectId !== incomingId)
      .sort((a, b) => a.lastAccessed - b.lastAccessed);
    return candidates[0] ?? null;
  }
}
