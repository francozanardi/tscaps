import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import {
  IndexedDbLruProjectCache,
  type ProjectCacheEntry,
} from '@core/_shared/infrastructure/IndexedDbLruProjectCache';
import { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import type { PersonSegmentationMask } from '@core/person-segmentation/domain/PersonSegmentationMask';
import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import type { PersonSegmentationResultAssembler } from '@core/person-segmentation/services/PersonSegmentationResultAssembler';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';
import type { PassingSample } from '@core/person-segmentation/domain/PassingSample';
import type { PersonSegmentationWindow } from '@core/person-segmentation/domain/PersonSegmentationWindow';

const STORE = 'person-segmentation-cache';
const ACCESS_STORE = 'person-segmentation-cache-access';

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
 * The number of stored projects is capped by `maxCachedProjects`.
 *
 * Records carry a `version` so entries written before `windows` could
 * be `null` are read under their own rules; see `readWindows`.
 */
export class IndexedDbPersonSegmentationCacheRepository implements PersonSegmentationCacheRepository {
  private readonly entries: IndexedDbLruProjectCache<PersonSegmentationCacheRecord>;

  constructor(
    db: IndexedDbClient,
    private readonly assembler: PersonSegmentationResultAssembler,
    maxCachedProjects: number,
  ) {
    this.entries = new IndexedDbLruProjectCache<PersonSegmentationCacheRecord>(db, STORE, ACCESS_STORE, maxCachedProjects);
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
    return this.entries.delete(projectId);
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
