import type { EditorStore } from '@core/editor/store/EditorStore';
import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import type { LoadedPersonSegmentationCacheStore } from '@core/person-segmentation/store/LoadedPersonSegmentationCacheStore';

/**
 * Keeps the in-memory cache slot aligned with the loaded project:
 * on every project switch, loads that project's cached detector
 * result from the repository and publishes it, or clears the slot
 * when the project has no cached result. A concurrent switch
 * supersedes an earlier one — the stale load's result is dropped.
 */
export class PersonSegmentationCacheHydrationAutomation {
  private lastSeenProjectId: string | null = null;
  private currentToken: symbol | null = null;

  constructor(
    private readonly editorStore: EditorStore,
    private readonly cacheRepository: PersonSegmentationCacheRepository,
    private readonly loadedStore: LoadedPersonSegmentationCacheStore,
  ) {}

  start(): void {
    this.editorStore.addEventListener('change', this.onStoreChange);
    void this.evaluate();
  }

  stop(): void {
    this.editorStore.removeEventListener('change', this.onStoreChange);
  }

  private readonly onStoreChange = (): void => {
    void this.evaluate();
  };

  private async evaluate(): Promise<void> {
    const projectId = this.editorStore.snapshot().projectId;
    if (projectId === this.lastSeenProjectId) return;
    this.lastSeenProjectId = projectId;
    if (projectId === null) {
      this.currentToken = null;
      this.loadedStore.clear();
      return;
    }
    const token = Symbol();
    this.currentToken = token;
    try {
      const result = await this.cacheRepository.load(projectId);
      if (this.currentToken !== token) return;
      if (result === null) this.loadedStore.clear();
      else this.loadedStore.publish(projectId, result);
    } catch (error) {
      console.error('[person-segmentation] cache hydration failed', error);
      if (this.currentToken !== token) return;
      this.loadedStore.clear();
    }
  }
}
