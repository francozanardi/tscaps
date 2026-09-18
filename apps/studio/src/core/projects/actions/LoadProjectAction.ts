import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { Project } from '@core/projects/domain/Project';
import type { ProjectName } from '@core/projects/domain/ProjectName';
import type { TemplateBrowserSupportChecker } from '@core/browser-support/services/TemplateBrowserSupportChecker';
import type { ExportStore } from '@core/export/store/ExportStore';
import type { TemplateSubstitutionNotifier } from '@core/templates/domain/TemplateSubstitutionNotifier';
import type { PreviewProxyResolver } from '@core/preview/services/PreviewProxyResolver';
import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type { StartOriginalVideoDownloadAction } from '@core/projects/actions/StartOriginalVideoDownloadAction';
import type { OriginalVideoDownloadStore } from '@core/projects/store/OriginalVideoDownloadStore';
import type { PreviewProxyDownloadStore } from '@core/preview/store/PreviewProxyDownloadStore';
import type { VideoCompatibilityChecker } from '@core/videos/domain/VideoCompatibilityChecker';
import type { BehindActorTemplateSubstituter } from '@core/person-segmentation/services/BehindActorTemplateSubstituter';
import type { ProjectOpenTelemetryReporter } from '@core/projects/services/ProjectOpenTelemetryReporter';
import type { VideoBlobLookup, VideoBlobMissReason, VideoBlobSource } from '@core/videos/domain/VideoBlobLookup';
import { ProjectNotFoundError } from '@core/projects/domain/errors/ProjectNotFoundError';

/**
 * What every outcome of {@link LoadProjectAction.execute} carries.
 *
 * `substitutedTemplateIds` lists template ids that were replaced with
 * a fallback: either the catalog no longer carries them, or they need
 * the text-behind-actor effect and this project's preview will not be
 * able to render it. The loaded project reflects the substitution;
 * the caller is expected to surface a notice so the user understands
 * the swap.
 */
interface LoadProjectOutcome {
  readonly project: Project;
  readonly substitutedTemplateIds: ReadonlyArray<string>;
}

/**
 * The editor is open. The source video is either already in the
 * editor store or being fetched in the background, in which case
 * `videoSource` is `null` because nothing has read it yet.
 */
export interface ProjectOpened extends LoadProjectOutcome {
  readonly kind: 'opened';
  readonly videoSource: VideoBlobSource | null;
}

/**
 * The editor is open on a project whose source bytes could not be
 * found anywhere; `reason` says why, and the route should prompt the
 * user to pick the file again.
 */
export interface ProjectVideoMissing extends LoadProjectOutcome {
  readonly kind: 'video-missing';
  readonly reason: VideoBlobMissReason;
}

/**
 * A sheet references a template this browser cannot render, so the
 * editor state was left untouched. `unsupportedTemplateIds` names them.
 */
export interface ProjectBlockedByTemplates extends LoadProjectOutcome {
  readonly kind: 'blocked-by-templates';
  readonly unsupportedTemplateIds: ReadonlyArray<string>;
}

export type LoadProjectResult = ProjectOpened | ProjectVideoMissing | ProjectBlockedByTemplates;

/**
 * Where the original bytes were read from during one open, or `null`
 * while nothing has read them yet. Kept apart from the result so a
 * failure can still say which copy was being read when it happened.
 */
interface OpenProgress {
  videoSource: VideoBlobSource | null;
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
 * cold path — load the original and play it directly — when both
 * cache and remote miss. Opening never generates a proxy.
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
 * Cancellation: an optional `AbortSignal` may be supplied. When it
 * fires, the in-flight video fetch aborts and no further store
 * mutations happen; the method rejects with an `AbortError`. Callers
 * that navigate away mid-load use this to keep a stale load from
 * stomping the state of the next project.
 *
 * Throws when the requested project id is unknown.
 */
export class LoadProjectAction {
  constructor(
    private readonly editorStore: EditorStore,
    private readonly exportStore: ExportStore,
    private readonly downloadStore: OriginalVideoDownloadStore,
    private readonly proxyDownloadStore: PreviewProxyDownloadStore,
    private readonly repository: ProjectRepository,
    private readonly refresh: RefreshDocumentAction,
    private readonly templateSupportChecker: TemplateBrowserSupportChecker,
    private readonly templateSubstitutionNotifier: TemplateSubstitutionNotifier,
    private readonly previewProxyResolver: PreviewProxyResolver,
    private readonly startOriginalDownload: StartOriginalVideoDownloadAction,
    private readonly compatibilityChecker: VideoCompatibilityChecker,
    private readonly behindActorSubstituter: BehindActorTemplateSubstituter,
    private readonly projectName: ProjectName,
    private readonly telemetryReporter: ProjectOpenTelemetryReporter,
  ) {}

  async execute(projectId: string, signal?: AbortSignal): Promise<LoadProjectResult> {
    this.exportStore.reset();
    this.downloadStore.reset();
    this.proxyDownloadStore.reset();
    const substituted = new Set<string>();
    const unsubscribe = this.templateSubstitutionNotifier.subscribe((id) => { substituted.add(id); });
    const startedAt = Date.now();
    const progress: OpenProgress = { videoSource: null };
    try {
      const result = await this.loadUnderSubscription(projectId, substituted, progress, signal);
      this.reportOutcome(result, Date.now() - startedAt);
      return result;
    } catch (cause) {
      // An abort is the caller navigating away, not a failure. Counting
      // one would report every project the reader opened and left as a
      // project that refused to open.
      if (!signal?.aborted) {
        this.telemetryReporter.reportFailed(cause, progress.videoSource, Date.now() - startedAt);
      }
      throw cause;
    } finally {
      unsubscribe();
    }
  }

  private reportOutcome(result: LoadProjectResult, elapsedMs: number): void {
    switch (result.kind) {
      case 'blocked-by-templates':
        this.telemetryReporter.reportBlockedByTemplates(result.unsupportedTemplateIds.length, elapsedMs);
        return;
      case 'video-missing':
        this.telemetryReporter.reportVideoRecoveryOffered(result.reason, elapsedMs);
        return;
      case 'opened':
        this.telemetryReporter.reportOpened(result.substitutedTemplateIds.length, result.videoSource, elapsedMs);
    }
  }

  private async loadUnderSubscription(
    projectId: string,
    substituted: Set<string>,
    progress: OpenProgress,
    signal: AbortSignal | undefined,
  ): Promise<LoadProjectResult> {
    const loaded = await this.repository.load(projectId);
    if (!loaded) throw new ProjectNotFoundError(projectId);
    signal?.throwIfAborted();

    const unsupportedTemplateIds = this.collectUnsupportedTemplates(loaded);
    if (unsupportedTemplateIds.length > 0) {
      return { kind: 'blocked-by-templates', project: loaded, unsupportedTemplateIds, substitutedTemplateIds: [...substituted] };
    }

    this.releasePreviousObjectUrl();
    this.enterLoadingState();
    this.downloadStore.start();

    const project = await this.tryFastPath(loaded, substituted, signal);
    if (project) {
      return { kind: 'opened', project, videoSource: null, substitutedTemplateIds: [...substituted] };
    }
    return this.runColdPath(loaded, substituted, progress, signal);
  }

  /**
   * Publishes the preview proxy from persistence when it is
   * available, without requiring the original bytes. On success,
   * commits the project with `file: null` and dispatches the
   * original-video download in the background under the same
   * cancellation signal so navigating away aborts the download too.
   *
   * Resolves to the committed project, or `null` when the repository
   * holds no proxy and the cold path has to run instead.
   */
  private async tryFastPath(
    loaded: Project,
    substituted: Set<string>,
    signal: AbortSignal | undefined,
  ): Promise<Project | null> {
    this.editorStore.patch({ projectId: loaded.id });
    const proxy = await this.fetchProxy(loaded.id);
    signal?.throwIfAborted();
    if (!proxy) return null;
    this.editorStore.patchVideo({ preview: { kind: 'proxy', file: proxy.blob } });
    const project = await this.behindActorSubstituter.substitute(loaded);
    this.commitProject(project, null, substituted.size > 0);
    this.refresh.execute();
    void this.startOriginalDownload.execute(signal);
    return project;
  }

  /**
   * The proxy is what the reader is held on: it gates the editor
   * opening, while the original streams in behind it. So this is the
   * fetch whose progress they are shown, and the store returns to
   * idle either way — a proxy read from local storage reports nothing
   * at all, and a fetch that ended has nothing left to report.
   */
  private async fetchProxy(projectId: string): Promise<PreviewProxy | null> {
    try {
      return await this.previewProxyResolver.fromRepository(
        projectId,
        (fraction) => this.proxyDownloadStore.report(fraction),
      );
    } finally {
      this.proxyDownloadStore.reset();
    }
  }

  /**
   * Falls back to fetching the original bytes and playing them. A
   * project whose bytes are found nowhere still opens, without a
   * video, so the route can offer to take the file again.
   */
  private async runColdPath(
    loaded: Project,
    substituted: Set<string>,
    progress: OpenProgress,
    signal: AbortSignal | undefined,
  ): Promise<ProjectOpened | ProjectVideoMissing> {
    const lookup = await this.downloadOriginalWithProgress(loaded.id, signal);
    signal?.throwIfAborted();
    const blob = lookup.outcome === 'found' ? lookup.blob : null;
    if (lookup.outcome === 'found') {
      progress.videoSource = lookup.source;
      await this.compatibilityChecker.check(lookup.blob);
      signal?.throwIfAborted();
      this.playSourceWithoutProxy(lookup.blob);
    }
    const project = await this.behindActorSubstituter.substitute(loaded);
    this.commitProject(project, blob, substituted.size > 0);
    this.refresh.execute();
    const substitutedTemplateIds = [...substituted];
    if (lookup.outcome === 'missing') {
      // Nothing is in flight any more, and the store's only reader
      // waits on any non-idle status reaching a terminal one. Leaving
      // it mid-download is a wait that nothing would ever release.
      this.downloadStore.reset();
      return { kind: 'video-missing', project, reason: lookup.reason, substitutedTemplateIds };
    }
    this.downloadStore.markReady();
    return { kind: 'opened', project, videoSource: lookup.source, substitutedTemplateIds };
  }

  private async downloadOriginalWithProgress(
    projectId: string,
    signal: AbortSignal | undefined,
  ): Promise<VideoBlobLookup> {
    this.downloadStore.start();
    return this.repository.loadVideoBlob(
      projectId,
      (fraction) => this.downloadStore.setProgress(fraction),
      signal,
    );
  }

  /**
   * Plays the source, without generating anything.
   *
   * Only reached when the repository holds no proxy for this project,
   * which is not a reason to build one: opening is not importing. Any
   * stored proxy, wherever the repository keeps it, was already found
   * by the fast path — so reaching here means it was never made, or
   * that the video cache outlived it, and the two share a cap and
   * normally evict together. When the video is gone too, the recovery
   * prompt runs instead and does generate, from the file it is handed.
   *
   * Generating here charged the whole wait to every open of a project
   * that had already given up on one.
   */
  private playSourceWithoutProxy(source: Blob): void {
    this.editorStore.patchVideo({ preview: { kind: 'original', file: source, reason: 'none-stored' } });
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
        isProbing: false,
        currentTime: 0,
      },
      document: project.document,
      captionTracks: project.captionTracks,
      activeCaptionTrackId: project.activeCaptionTrackId,
      sheets: [...project.sheets],
      activeSheetId: project.activeSheetId,
      behindActorOverrides: project.behindActorOverrides,
      frozenSegments: project.frozenSegments,
      elementStyles: project.elementStyles,
      decorationOverrides: project.decorationOverrides,
      cuts: project.cuts,
      projectId: project.id,
      projectName: this.projectName.clamp(project.name),
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
    for (const track of project.captionTracks) {
      for (const sheet of track.sheets) {
        if (this.templateSupportChecker.isSupported(sheet.template)) continue;
        const id = sheet.template.metadata.id;
        if (seen.has(id)) continue;
        seen.add(id);
        result.push(id);
      }
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
