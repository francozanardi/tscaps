import type { EditorStore } from '@core/editor/store/EditorStore';
import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import type { PersonSegmentationFlowStore } from '@core/person-segmentation/store/PersonSegmentationFlowStore';

/**
 * Opens the prepare-person-segmentation dialog when the active
 * sheet's template starts requiring the effect and no cached result
 * exists for the loaded project. Re-selecting the same template
 * after a cancel triggers the dialog again — the tracker only
 * suppresses repeats while the same template stays selected.
 * Sessions without a persisted project id always open the dialog
 * since there is no repository to consult; the resulting scan lives
 * only in memory. The dialog stays closed silently on a cache hit.
 */
export class PersonSegmentationTriggerAutomation {
  private lastCheckedTemplateId: string | null = null;

  constructor(
    private readonly editorStore: EditorStore,
    private readonly cacheRepository: PersonSegmentationCacheRepository,
    private readonly flowStore: PersonSegmentationFlowStore,
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
    const activeSheet = this.editorStore.activeSheet();
    const templateId = activeSheet?.template.metadata.id ?? null;
    if (templateId === this.lastCheckedTemplateId) return;
    this.lastCheckedTemplateId = templateId;
    if (!activeSheet) return;
    if (!activeSheet.template.rendering.behindActor.required) return;
    const projectId = this.editorStore.snapshot().projectId;
    if (projectId !== null) {
      const cached = await this.cacheRepository.load(projectId);
      if (cached !== null) return;
    }
    this.flowStore.openConfirm();
  }
}
