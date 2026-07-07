import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { Project } from '@core/projects/domain/Project';
import type { TemplateBrowserSupportChecker } from '@core/browser-support/services/TemplateBrowserSupportChecker';
import type { ExportStore } from '@core/export/store/ExportStore';
import type { TemplateSubstitutionNotifier } from '@core/templates/domain/TemplateSubstitutionNotifier';
import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';
import type { PreviewProxyResolver } from '@core/preview/services/PreviewProxyResolver';
import type { StartOriginalVideoDownloadAction } from '@core/projects/actions/StartOriginalVideoDownloadAction';
import type { OriginalVideoDownloadStore } from '@core/projects/store/OriginalVideoDownloadStore';
import type { VideoCompatibilityChecker } from '@core/videos/domain/VideoCompatibilityChecker';

/**
 * Outcome of {@link LoadProjectAction.execute}.
 *
 * - `videoRecovered` is `true` when the source video is either already
 *   in the editor store or is being fetched asynchronously in the
 *   background; `false` means the project has no recoverable source
 *   bytes and the route should prompt the user to re-pick a file.
 * - `unsupportedTemplateIds` lists any template ids referenced by the
 *   project's sheets that the current browser cannot render. When
 *   non-empty, the editor state is left untouched.
 * - `substitutedTemplateIds` lists template ids that were missing from
 *   the catalog and replaced with a fallback during deserialization.
 *   The loaded project reflects the substitution; the caller is
 *   expected to surface a notice so the user understands the swap.
 */
export interface LoadProjectResult {
  readonly project: Project;
  readonly videoRecovered: boolean;
  readonly unsupportedTemplateIds: ReadonlyArray<string>;
  readonly substitutedTemplateIds: ReadonlyArray<string>;
}

/**
 * Hydrates the editor state from a persisted `Project` identified by
 * id. Restores the document, sheets, override registries, and project
 * metadata, and resolves the preview proxy before the splash clears.
 *
 * Takes a fast path when the proxy is available locally (cache) or
 * via the optional remote sync: the editor opens against the proxy
 * with the original-video bytes still in flight, and a background
 * download fills `video.file` when the bytes land. Falls back to a
 * cold path — load the original first, generate the proxy from it —
 * when both cache and remote miss.
 *
 * If any sheet references a template outside the support set, the
 * store is left untouched and the result carries the offending ids
 * in `unsupportedTemplateIds`.
 *
 * Atomic transition: while resources hydrate, `status` stays at
 * `'loading-project'` and the rest of the editor state is left
 * untouched. The status only flips to `'idle'` together with the
 * full editor patch, so observers never see a half-loaded project.
 *
 * Throws when the requested project id is unknown.
 */
export class LoadProjectAction {
  constructor(
    private readonly editorStore: EditorStore,
    private readonly exportStore: ExportStore,
    private readonly downloadStore: OriginalVideoDownloadStore,
    private readonly repository: ProjectRepository,
    private readonly refresh: RefreshDocumentAction,
    private readonly templateSupportChecker: TemplateBrowserSupportChecker,
    private readonly templateSubstitutionNotifier: TemplateSubstitutionNotifier,
    private readonly previewProxyResolver: PreviewProxyResolver,
    private readonly proxyRepository: PreviewProxyRepository,
    private readonly startOriginalDownload: StartOriginalVideoDownloadAction,
    private readonly compatibilityChecker: VideoCompatibilityChecker,
  ) {}

  async execute(projectId: string): Promise<LoadProjectResult> {
    this.exportStore.reset();
    this.downloadStore.reset();
    const { project, substitutedTemplateIds } = await this.loadProjectWithSubstitutions(projectId);

    const unsupportedTemplateIds = this.collectUnsupportedTemplates(project);
    if (unsupportedTemplateIds.length > 0) {
      return { project, videoRecovered: false, unsupportedTemplateIds, substitutedTemplateIds };
    }

    this.releasePreviousObjectUrl();
    this.enterLoadingState();

    const usedFastPath = await this.tryFastPath(project, substitutedTemplateIds);
    if (usedFastPath) {
      return { project, videoRecovered: true, unsupportedTemplateIds: [], substitutedTemplateIds };
    }
    const videoRecovered = await this.runColdPath(project, substitutedTemplateIds);
    return { project, videoRecovered, unsupportedTemplateIds: [], substitutedTemplateIds };
  }

  private async loadProjectWithSubstitutions(projectId: string): Promise<{
    project: Project;
    substitutedTemplateIds: ReadonlyArray<string>;
  }> {
    const collected = new Set<string>();
    const unsubscribe = this.templateSubstitutionNotifier.subscribe((id) => { collected.add(id); });
    try {
      const project = await this.repository.load(projectId);
      if (!project) throw new Error(`Project not found: ${projectId}`);
      return { project, substitutedTemplateIds: [...collected] };
    } finally {
      unsubscribe();
    }
  }

  /**
   * Publishes the preview proxy from persistence when it is
   * available, without requiring the original bytes. On success,
   * commits the project with `file: null` and dispatches the
   * original-video download in the background.
   */
  private async tryFastPath(
    project: Project,
    substitutedTemplateIds: ReadonlyArray<string>,
  ): Promise<boolean> {
    this.editorStore.patch({ projectId: project.id });
    const proxy = await this.previewProxyResolver.fromRepository(project.id);
    if (!proxy) return false;
    this.editorStore.patchVideo({ previewFile: proxy.blob });
    this.commitProject(project, null, substitutedTemplateIds.length > 0);
    this.refresh.execute();
    void this.startOriginalDownload.execute();
    return true;
  }

  /**
   * Falls back to fetching the original bytes and generating the
   * proxy from them. Returns `true` when the bytes were recovered
   * and committed to the store; `false` when the project has no
   * source bytes available.
   */
  private async runColdPath(
    project: Project,
    substitutedTemplateIds: ReadonlyArray<string>,
  ): Promise<boolean> {
    const blob = await this.downloadOriginalWithProgress(project.id);
    if (blob) {
      await this.compatibilityChecker.check(blob);
      await this.publishPreviewProxy(project.id, blob);
    }
    this.commitProject(project, blob, substitutedTemplateIds.length > 0);
    this.refresh.execute();
    if (blob) this.downloadStore.markReady();
    return blob !== null;
  }

  private async downloadOriginalWithProgress(projectId: string): Promise<Blob | null> {
    this.downloadStore.start();
    return this.repository.loadVideoBlob(projectId, (fraction) => this.downloadStore.setProgress(fraction));
  }

  private async publishPreviewProxy(projectId: string, source: Blob): Promise<void> {
    const cached = await this.previewProxyResolver.fromRepository(projectId);
    if (cached) {
      this.editorStore.patchVideo({ previewFile: cached.blob });
      return;
    }
    const resolution = await this.previewProxyResolver.fromSource(source);
    this.editorStore.patchVideo({ previewFile: resolution.previewBlob });
    if (resolution.freshProxy) this.dispatchProxyStore(projectId, resolution.freshProxy);
  }

  private dispatchProxyStore(projectId: string, proxy: PreviewProxy): void {
    void this.proxyRepository.store(projectId, proxy).catch((error) => {
      console.error('[load-project] preview-proxy store failed', error);
    });
  }

  private enterLoadingState(): void {
    this.editorStore.patch({ status: 'loading-project' });
  }

  // `dirty` starts true when at least one sheet's template was
  // substituted: the in-memory project no longer matches what is on
  // disk, and a save is required to persist the swap.
  private commitProject(project: Project, blob: Blob | null, dirty: boolean): void {
    const videoFile = blob ? this.toFile(blob, project.video.fileName, project.video.mimeType) : null;
    const videoUrl = videoFile ? URL.createObjectURL(videoFile) : null;
    this.editorStore.patch({
      video: {
        file: videoFile,
        url: videoUrl,
        fileName: project.video.fileName,
        mimeType: project.video.mimeType,
        size: project.video.size,
        layout: project.videoLayout,
        duration: project.video.duration,
        currentTime: 0,
      },
      document: project.document,
      sheets: [...project.sheets],
      activeSheetId: project.activeSheetId,
      wordStyleOverrides: project.wordStyleOverrides,
      segmentOverrides: project.segmentOverrides,
      decorationOverrides: project.decorationOverrides,
      cuts: project.cuts,
      projectId: project.id,
      projectName: project.name,
      projectCreatedAt: project.createdAt,
      projectThumbnail: project.thumbnail,
      status: 'idle',
      error: null,
      dirty,
    });
  }

  private collectUnsupportedTemplates(project: Project): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const sheet of project.sheets) {
      if (this.templateSupportChecker.isSupported(sheet.template)) continue;
      const id = sheet.template.metadata.id;
      if (seen.has(id)) continue;
      seen.add(id);
      result.push(id);
    }
    return result;
  }

  private releasePreviousObjectUrl(): void {
    const { video } = this.editorStore.snapshot();
    if (video.url) URL.revokeObjectURL(video.url);
  }

  /**
   * Reconstructs a File from the cached Blob. The bytes are shared (no
   * copy); we only re-attach the original filename and MIME type so that
   * downstream consumers expecting a `File` (e.g., the transcriber) get
   * a faithful object.
   */
  private toFile(blob: Blob, fileName: string, mimeType: string): File {
    return new File([blob], fileName, { type: mimeType });
  }
}
