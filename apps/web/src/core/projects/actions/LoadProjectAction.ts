import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { Project } from '@core/projects/domain/Project';
import type { TemplateBrowserSupportChecker } from '@core/browser-support/services/TemplateBrowserSupportChecker';
import type { ExportStore } from '@core/export/store/ExportStore';
import type { TemplateSubstitutionNotifier } from '@core/templates/domain/TemplateSubstitutionNotifier';

/**
 * Outcome of {@link LoadProjectAction.execute}.
 *
 * - `videoRecovered` is `true` when the cached video Blob was found
 *   and rehydrated; `false` means the cached blob is gone and a fresh
 *   file selection is required to make the project editable.
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
 * metadata, and best-effort rehydrates the cached video Blob into a
 * `File`.
 *
 * If any sheet in the project references a template outside the
 * `SupportReport`'s supported set, the store is left untouched and
 * the result carries the offending ids in `unsupportedTemplateIds`.
 *
 * Atomic transition: while the video blob is being fetched, `status`
 * stays at `'loading-project'` and the rest of the editor state is
 * left untouched. The status only flips to `'idle'` together with the
 * full editor patch, so observers never see a half-loaded project.
 *
 * Throws when the requested project id is unknown.
 */
export class LoadProjectAction {
  constructor(
    private readonly editorStore: EditorStore,
    private readonly exportStore: ExportStore,
    private readonly repository: ProjectRepository,
    private readonly refresh: RefreshDocumentAction,
    private readonly templateSupportChecker: TemplateBrowserSupportChecker,
    private readonly templateSubstitutionNotifier: TemplateSubstitutionNotifier,
  ) {}

  async execute(projectId: string): Promise<LoadProjectResult> {
    const substitutedTemplateIds = new Set<string>();
    const unsubscribe = this.templateSubstitutionNotifier.subscribe((id) => { substitutedTemplateIds.add(id); });
    let project: Project | null;
    try {
      project = await this.repository.load(projectId);
    } finally {
      unsubscribe();
    }
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const substituted = [...substitutedTemplateIds];
    const unsupportedTemplateIds = this.collectUnsupportedTemplates(project);
    if (unsupportedTemplateIds.length > 0) {
      return { project, videoRecovered: false, unsupportedTemplateIds, substitutedTemplateIds: substituted };
    }

    this.releasePreviousObjectUrl();
    this.enterLoadingState();
    const blob = await this.repository.loadVideoBlob(projectId);
    this.commitProject(project, blob, substituted.length > 0);

    this.refresh.execute();

    return { project, videoRecovered: blob !== null, unsupportedTemplateIds: [], substitutedTemplateIds: substituted };
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
        layout: project.videoLayout,
        duration: project.video.duration,
        currentTime: 0,
      },
      document: project.document,
      sheets: [...project.sheets],
      activeSheetId: project.activeSheetId,
      wordStyleOverrides: project.wordStyleOverrides,
      segmentOverrides: project.segmentOverrides,
      projectId: project.id,
      projectName: project.name,
      projectCreatedAt: project.createdAt,
      projectThumbnail: project.thumbnail,
      status: 'idle',
      error: null,
      dirty,
    });
    this.exportStore.reset();
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
