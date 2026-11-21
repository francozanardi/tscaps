import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { ProjectCacheEntry } from '@core/_shared/infrastructure/IndexedDbLruProjectCache';
import type { ProjectDependentStore } from '@core/_shared/infrastructure/ProjectDependentStore';

/**
 * One IndexedDB object store holding one entry per project, keyed by
 * `projectId`, with no eviction order of its own: which projects it may
 * hold is the video cache's to say, through {@link retainOnly}. Its
 * entries can always be made again, so evicting one is deleting it.
 */
export class IndexedDbProjectStore<TEntry extends ProjectCacheEntry> implements ProjectDependentStore {
  constructor(
    private readonly db: IndexedDbClient,
    private readonly storeName: string,
  ) {}

  read(projectId: string): Promise<TEntry | null> {
    return this.db.readOne<TEntry>(this.storeName, projectId);
  }

  write(projectId: string, payload: Omit<TEntry, keyof ProjectCacheEntry>): Promise<void> {
    return this.db.writeOne(this.storeName, { ...payload, projectId });
  }

  deleteProject(projectId: string): Promise<void> {
    return this.db.deleteOne(this.storeName, projectId);
  }

  evictProject(projectId: string): Promise<void> {
    return this.deleteProject(projectId);
  }

  async retainOnly(projectIds: ReadonlySet<string>): Promise<void> {
    const held = await this.db.readAllKeys(this.storeName);
    for (const key of held) {
      if (!projectIds.has(String(key))) await this.db.deleteOne(this.storeName, key);
    }
  }
}
