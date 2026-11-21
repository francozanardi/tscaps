import type { ProjectDependentStore } from '@core/_shared/infrastructure/ProjectDependentStore';

/**
 * Every store that lives and dies with a project's video, answered as
 * one. Stores are added while the app is composed, since the feature
 * that owns each one is booted after the video cache that drives them.
 *
 * Each store is asked on its own and a failure is only logged: one
 * store refusing must not keep the others holding a project the device
 * has let go of, and whatever it failed to drop goes on the next pass.
 */
export class ProjectDependentStores implements ProjectDependentStore {
  private readonly stores: ProjectDependentStore[] = [];

  add(store: ProjectDependentStore): void {
    this.stores.push(store);
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.forEachStore((store) => store.deleteProject(projectId));
  }

  async evictProject(projectId: string): Promise<void> {
    await this.forEachStore((store) => store.evictProject(projectId));
  }

  async retainOnly(projectIds: ReadonlySet<string>): Promise<void> {
    await this.forEachStore((store) => store.retainOnly(projectIds));
  }

  private async forEachStore(run: (store: ProjectDependentStore) => Promise<void>): Promise<void> {
    for (const store of this.stores) {
      try {
        await run(store);
      } catch (error) {
        console.error('[project-storage] dropping a project\'s dependent entries failed', error);
      }
    }
  }
}
