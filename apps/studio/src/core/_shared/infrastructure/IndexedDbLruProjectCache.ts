import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';

/**
 * The one field this cache writes on every payload record: the project
 * the entry belongs to. Owners add their own payload on top.
 */
export interface ProjectCacheEntry {
  readonly projectId: string;
}

interface AccessRecord {
  readonly projectId: string;
  readonly lastAccessed: number;
}

/**
 * One IndexedDB object store holding at most `maxCachedProjects`
 * entries, one per project, evicted least-recently-read first. Both
 * stores it is given must declare `projectId` as their key path.
 *
 * Owners keep the entry shape and the mapping to their own domain;
 * residency is this class's business — stamping the access time,
 * choosing the victim, and evicting before a write that would take
 * the store past the cap.
 *
 * The access time lives in `accessStoreName`, apart from the payload.
 * A payload here is typically a video's bytes, and a `put` of a record
 * that carries a `Blob` copies the whole file on WebKit: recording a
 * read by rewriting the payload cost up to half a second per open of
 * a 200 MiB video where a record of its own costs one millisecond.
 * Keeping them apart also lets eviction pick its victim from the
 * access records alone, without pulling every payload out of the
 * store to compare timestamps.
 *
 * A payload with no access record counts as the least recently read:
 * it is either older than the access store, or its read could not be
 * recorded, and either way it is the cheapest entry to lose.
 *
 * A read survives an origin with no room left. A write does not. See
 * {@link read} and {@link write}.
 */
export class IndexedDbLruProjectCache<TEntry extends ProjectCacheEntry> {
  constructor(
    private readonly db: IndexedDbClient,
    private readonly storeName: string,
    private readonly accessStoreName: string,
    private readonly maxCachedProjects: number,
  ) {}

  /**
   * Reads the entry held for `projectId`, or `null` when there is
   * none. Moves it to the back of the eviction queue, and resolves
   * whether or not that bookkeeping write goes through, so a device
   * with no room left still hands back what it holds.
   */
  async read(projectId: string): Promise<TEntry | null> {
    const entry = await this.db.readOne<TEntry>(this.storeName, projectId);
    if (!entry) return null;
    await this.recordAccessBestEffort(projectId);
    return entry;
  }

  /**
   * Writes `payload` as the entry of `projectId`, stamped as the most
   * recently read, evicting the least recent entry first when the
   * cache is already at the cap. Replacing the entry a project
   * already has is not growth, so refreshing one project's entry
   * never evicts another's.
   *
   * Raises whatever the database raised — an entry that did not reach
   * disk is a fact its owner has to act on, unlike the access time.
   */
  async write(projectId: string, payload: Omit<TEntry, keyof ProjectCacheEntry>): Promise<void> {
    await this.evictIfNeeded(projectId);
    await this.db.writeOne(this.storeName, { ...payload, projectId });
    await this.recordAccessBestEffort(projectId);
  }

  async delete(projectId: string): Promise<void> {
    await this.db.deleteOne(this.storeName, projectId);
    await this.db.deleteOne(this.accessStoreName, projectId);
  }

  /**
   * Refreshing the eviction order is bookkeeping about a read, not
   * part of one, and it is still a write: an origin with nothing left
   * to give refuses it like any other. Raising here would stop a
   * project whose bytes were just read intact from opening at all,
   * while a stale timestamp costs no more than a worse choice of
   * victim the next time something has to be evicted.
   */
  private async recordAccessBestEffort(projectId: string): Promise<void> {
    const record: AccessRecord = { projectId, lastAccessed: Date.now() };
    try {
      await this.db.writeOne(this.accessStoreName, record);
    } catch { /* the eviction order is worth less than the read it would fail */ }
  }

  private async evictIfNeeded(incomingId: string): Promise<void> {
    const held = await this.db.readAllKeys(this.storeName);
    const isReplacement = held.some((key) => key === incomingId);
    const projectedSize = isReplacement ? held.length : held.length + 1;
    if (projectedSize <= this.maxCachedProjects) return;
    const victim = await this.pickEvictionVictim(held, incomingId);
    if (victim !== null) await this.delete(victim);
  }

  private async pickEvictionVictim(held: IDBValidKey[], incomingId: string): Promise<string | null> {
    const accesses = await this.db.readAll<AccessRecord>(this.accessStoreName);
    const lastAccessedOf = new Map(accesses.map((record) => [record.projectId, record.lastAccessed]));
    const candidates = held
      .map((key) => String(key))
      .filter((projectId) => projectId !== incomingId)
      .sort((a, b) => (lastAccessedOf.get(a) ?? 0) - (lastAccessedOf.get(b) ?? 0));
    return candidates[0] ?? null;
  }
}
