import type { EditorStore } from '@core/editor/store/EditorStore';
import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import type { HiddenVideoLoader } from '@core/person-segmentation/services/HiddenVideoLoader';
import type { ScanVideoSource, ScanVideoSourceResolver } from '@core/person-segmentation/services/ScanVideoSourceResolver';
import type { RunPersonSegmentationAction } from '@core/person-segmentation/actions/RunPersonSegmentationAction';
import type { LoadedPersonSegmentationCacheStore } from '@core/person-segmentation/store/LoadedPersonSegmentationCacheStore';

/**
 * Runs the detector against the currently loaded video (the preview
 * proxy when available), persists the result under the loaded
 * project's id when there is one, and publishes it into the in-memory
 * loaded-cache slot so the preview overlay can start painting
 * immediately. Sessions without a persisted project id are
 * supported: the result lives only in memory. Throws when no video
 * is loaded or when the underlying run fails. The hidden video
 * element used to drive the scan is released before the promise
 * settles, regardless of the run's outcome.
 */
export class EnsurePersonSegmentationCachedAction {

  constructor(
    private readonly editorStore: EditorStore,
    private readonly sourceResolver: ScanVideoSourceResolver,
    private readonly videoLoader: HiddenVideoLoader,
    private readonly runAction: RunPersonSegmentationAction,
    private readonly cacheRepository: PersonSegmentationCacheRepository,
    private readonly loadedStore: LoadedPersonSegmentationCacheStore,
  ) {}

  async execute(): Promise<void> {
    const projectId = this.editorStore.snapshot().projectId;
    const source = this.requireScanSource();
    try {
      const video = await this.videoLoader.load(source.url);
      try {
        const result = await this.runAction.execute({ video });
        if (projectId !== null) await this.cacheRepository.store(projectId, result);
        this.loadedStore.publish(projectId, result);
      } finally {
        this.videoLoader.dispose(video);
      }
    } finally {
      source.dispose();
    }
  }

  private requireScanSource(): ScanVideoSource {
    const source = this.sourceResolver.resolve(this.editorStore.snapshot().video);
    if (source === null) throw new Error('No video is loaded');
    return source;
  }
}
