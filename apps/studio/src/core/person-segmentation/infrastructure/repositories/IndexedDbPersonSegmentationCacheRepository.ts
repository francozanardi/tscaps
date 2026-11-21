import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { ProjectCacheEntry } from '@core/_shared/infrastructure/IndexedDbLruProjectCache';
import { IndexedDbProjectStore } from '@core/_shared/infrastructure/IndexedDbProjectStore';
import type { ProjectDependentStore } from '@core/_shared/infrastructure/ProjectDependentStore';
import { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import type { PersonSegmentationMask } from '@core/person-segmentation/domain/PersonSegmentationMask';
import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import type { PersonSegmentationResultAssembler } from '@core/person-segmentation/services/PersonSegmentationResultAssembler';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';
import type { PassingSample } from '@core/person-segmentation/domain/PassingSample';
import type { PersonSegmentationWindow } from '@core/person-segmentation/domain/PersonSegmentationWindow';

export const PERSON_SEGMENTATION_CACHE_STORE = 'person-segmentation-cache';

/** Records that record what was examined, not just what passed. Older ones carry a lower or absent `version`. */
const ANALYZED_RANGES_VERSION = 2;

interface PersonSegmentationCacheRecord extends ProjectCacheEntry {
  readonly version?: number;
  readonly analyzedRanges?: ReadonlyArray<PersonSegmentationWindow>;
  readonly samples?: ReadonlyArray<PassingSample>;
  /** Only on records written before `samples` existed; the scenes those runs found. */
  readonly windows?: ReadonlyArray<PersonSegmentationWindow> | null;
  readonly masks: ReadonlyArray<PersonSegmentationMask>;
}

/**
 * `PersonSegmentationCacheRepository` backed by the shared
 * `person-segmentation-cache` IndexedDB store. Serialises the mask
 * cache as an ordered array of `{ t, alpha, width, height }` records
 * inside a single per-project entry; IndexedDB's structured clone
 * carries the `Uint8Array` alpha bytes without an explicit encoding
 * step.
 *
 * It keeps no eviction order of its own: a project's masks live as
 * long as its source video on this device, which drops them as a
 * dependent.
 *
 * Records carry a `version` so entries written before `windows` could
 * be `null` are read under their own rules; see `readWindows`.
 */
export class IndexedDbPersonSegmentationCacheRepository implements PersonSegmentationCacheRepository, ProjectDependentStore {
  private readonly entries: IndexedDbProjectStore<PersonSegmentationCacheRecord>;

  constructor(
    db: IndexedDbClient,
    private readonly assembler: PersonSegmentationResultAssembler,
  ) {
    this.entries = new IndexedDbProjectStore<PersonSegmentationCacheRecord>(db, PERSON_SEGMENTATION_CACHE_STORE);
  }

  async load(projectId: string): Promise<PersonSegmentationResult | null> {
    const record = await this.entries.read(projectId);
    if (!record) return null;
    return this.toResult(record);
  }

  store(projectId: string, result: PersonSegmentationResult): Promise<void> {
    return this.entries.write(projectId, {
      version: ANALYZED_RANGES_VERSION,
      analyzedRanges: result.analyzedRanges.list(),
      samples: result.samples,
      masks: result.maskCache.toArray(),
    });
  }

  delete(projectId: string): Promise<void> {
    return this.entries.deleteProject(projectId);
  }

  deleteProject(projectId: string): Promise<void> {
    return this.entries.deleteProject(projectId);
  }

  evictProject(projectId: string): Promise<void> {
    return this.entries.evictProject(projectId);
  }

  retainOnly(projectIds: ReadonlySet<string>): Promise<void> {
    return this.entries.retainOnly(projectIds);
  }

  private toResult(record: PersonSegmentationCacheRecord): PersonSegmentationResult {
    const maskCache = new MaskCache();
    for (const mask of record.masks) maskCache.add(mask);
    if (record.version === ANALYZED_RANGES_VERSION) {
      return this.assembler.assemble(TimeRangeSet.of(record.analyzedRanges ?? []), record.samples ?? [], maskCache);
    }
    return this.fromWindowsOnlyRecord(record, maskCache);
  }

  /**
   * Reads a record written before coverage was tracked. Those runs
   * walked the whole video but only wrote down the scenes they found,
   * so the ranges they can still vouch for are exactly those scenes:
   * anything outside is reported as unexamined rather than as rejected,
   * which is the weaker claim and the only one the record supports. Two
   * passing samples per window reproduce it under the current rule.
   *
   * Older records also wrote `[]` for both "found nothing" and "never
   * ran". A completed run captures masks only inside its own windows,
   * so masks with no windows can only have come from a segment
   * backfill — and that carries no coverage at all.
   */
  private fromWindowsOnlyRecord(
    record: PersonSegmentationCacheRecord,
    maskCache: MaskCache,
  ): PersonSegmentationResult {
    const windows = record.windows ?? [];
    const samples = windows.flatMap((window) => [
      { t: window.start, passes: true },
      { t: window.end, passes: true },
    ]);
    return this.assembler.assemble(TimeRangeSet.of(windows), samples, maskCache);
  }
}
