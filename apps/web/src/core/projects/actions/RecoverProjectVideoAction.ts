import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';
import type { PreviewProxyResolver } from '@core/preview/services/PreviewProxyResolver';
import type { VideoCompatibilityChecker } from '@core/videos/domain/VideoCompatibilityChecker';
import type { VideoMetadataProbe } from '@core/videos/domain/VideoMetadataProbe';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';

/**
 * Re-attaches a freshly chosen video file to a project whose cached
 * blob was evicted by the LRU policy. Trusts the user that the file
 * matches the project — a wrong file only misaligns timings and is
 * recoverable by picking again.
 *
 * Publishes a preview proxy from the recovered file before handing
 * control back to the editor, so the preview surface has something
 * to load the moment the splash clears.
 */
export class RecoverProjectVideoAction {
  constructor(
    private readonly store: EditorStore,
    private readonly repository: ProjectRepository,
    private readonly previewProxyResolver: PreviewProxyResolver,
    private readonly proxyRepository: PreviewProxyRepository,
    private readonly compatibilityChecker: VideoCompatibilityChecker,
    private readonly metadataProbe: VideoMetadataProbe,
  ) {}

  async execute(file: File): Promise<void> {
    const snap = this.store.snapshot();
    if (!snap.projectId) throw new Error('No project loaded');
    const projectId = snap.projectId;

    await this.compatibilityChecker.check(file);

    if (snap.video.url) URL.revokeObjectURL(snap.video.url);

    await this.repository.cacheVideoBlob(projectId, file);
    await this.publishPreviewProxy(projectId, file);
    const metadata = await this.probeOriginalMetadata(file);

    this.store.patch({
      video: {
        file,
        url: URL.createObjectURL(file),
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        ...this.layoutFrom(metadata),
      },
      status: 'idle',
      error: null,
    });
  }

  private async publishPreviewProxy(projectId: string, source: Blob): Promise<void> {
    const cached = await this.previewProxyResolver.fromRepository(projectId);
    if (cached) {
      this.store.patchVideo({ previewFile: cached.blob });
      return;
    }
    const resolution = await this.previewProxyResolver.fromSource(source);
    this.store.patchVideo({ previewFile: resolution.previewBlob });
    if (resolution.freshProxy) this.dispatchProxyStore(projectId, resolution.freshProxy);
  }

  private async probeOriginalMetadata(file: File): Promise<VideoSourceMetadata | null> {
    try {
      return await this.metadataProbe.probe(file);
    } catch {
      return null;
    }
  }

  private layoutFrom(metadata: VideoSourceMetadata | null): { layout?: { width: number; height: number } } {
    if (!metadata) return {};
    if (metadata.videoWidthPx === null || metadata.videoHeightPx === null) return {};
    return { layout: { width: metadata.videoWidthPx, height: metadata.videoHeightPx } };
  }

  private dispatchProxyStore(projectId: string, proxy: PreviewProxy): void {
    void this.proxyRepository.store(projectId, proxy).catch((error) => {
      console.error('[recover-project-video] preview-proxy store failed', error);
    });
  }
}
