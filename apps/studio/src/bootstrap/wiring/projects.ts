import { BidiJsCharacterClassifier, HorizontalPlacementResolver, HorizontalSideResolver, StrongCharacterMajorityTextDirectionDetector } from '@tscaps/engine';
import { DocumentElementIdCollector } from '@core/captions/services/DocumentElementIdCollector';
import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { IndexedDbStoreDefinition } from '@core/_shared/infrastructure/IndexedDbStoreDefinition';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ExportStore } from '@core/export/store/ExportStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { BehindActorPreviewSupportChecker } from '@core/person-segmentation/services/BehindActorPreviewSupportChecker';
import { BehindActorTemplateSubstituter } from '@core/person-segmentation/services/BehindActorTemplateSubstituter';
import type { TemplateBrowserSupportChecker } from '@core/browser-support/services/TemplateBrowserSupportChecker';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import type { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import type { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import { ProjectName } from '@core/projects/domain/ProjectName';
import type { UnsavedWorkPolicy } from '@core/projects/domain/UnsavedWorkPolicy';
import { IndexedDbProjectRepository } from '@core/projects/infrastructure/repositories/IndexedDbProjectRepository';
import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';
import { TemplateSubstitutionNotifier } from '@core/templates/domain/TemplateSubstitutionNotifier';
import { FallbackingTemplateReferenceResolver } from '@core/templates/services/FallbackingTemplateReferenceResolver';
import { ProjectSerializer } from '@core/projects/services/ProjectSerializer';
import { ProjectMigrator } from '@core/projects/services/migrations/ProjectMigrator';
import { ThumbnailGenerator } from '@core/projects/services/ThumbnailGenerator';
import { ProjectFromEditorStateBuilder } from '@core/projects/services/ProjectFromEditorStateBuilder';
import { ProjectOpenTelemetryReporter } from '@core/projects/services/ProjectOpenTelemetryReporter';
import { EditorStateUnsavedWorkPolicy } from '@core/projects/services/EditorStateUnsavedWorkPolicy';
import { CreateProjectAction } from '@core/projects/actions/CreateProjectAction';
import { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import { LoadProjectAction } from '@core/projects/actions/LoadProjectAction';
import { DeleteProjectAction } from '@core/projects/actions/DeleteProjectAction';
import { ListProjectsAction } from '@core/projects/actions/ListProjectsAction';
import { ExportProjectAction } from '@core/projects/actions/ExportProjectAction';
import { ImportProjectAction } from '@core/projects/actions/ImportProjectAction';
import { RecoverProjectVideoAction } from '@core/projects/actions/RecoverProjectVideoAction';
import { StartOriginalVideoDownloadAction } from '@core/projects/actions/StartOriginalVideoDownloadAction';
import { OriginalVideoDownloadStore } from '@core/projects/store/OriginalVideoDownloadStore';
import { MediaBunnyVideoMetadataProbe } from '@core/videos/infrastructure/MediaBunnyVideoMetadataProbe';
import { RenameProjectAction } from '@core/projects/actions/RenameProjectAction';
import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import type { PreviewModule } from '@bootstrap/wiring/preview';
import type { VideoFilesModule } from '@bootstrap/wiring/videos';
import type { TelemetryModule } from '@bootstrap/wiring/telemetry';
import type { AppNoticeChannel } from '@core/errors/services/AppNoticeChannel';
import type { AppErrorClassifier } from '@core/errors/services/AppErrorClassifier';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import type { StorageFootprintProbe } from '@core/_shared/infrastructure/StorageFootprintProbe';
import type { FileDownloader } from '@core/_shared/domain/FileDownloader';
import { TypographyConfigSerializer } from '@core/sheets/services/TypographyConfigSerializer';
import { StoredFontStackReader } from '@core/fonts/services/StoredFontStackReader';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';

export interface ProjectsDependencies {
  readonly templateRepository: TemplateRepository;
  /**
   * Where a behind-actor template that cannot be rendered goes
   * looking for its replacement — the same catalog the gallery
   * offers, so the swap lands on something this session can show.
   */
  readonly behindActorFallbackTemplates: TemplateRepository;
  readonly behindActorSupportChecker: BehindActorPreviewSupportChecker;
  readonly store: EditorStore;
  readonly exportStore: ExportStore;
  readonly refresh: RefreshDocumentAction;
  readonly templateSupportChecker: TemplateBrowserSupportChecker;
  readonly styledElementCatalog: StyledElementCatalog;
  readonly controlCssWriter: ElementControlCssWriter;
  readonly animationCssWriter: ElementAnimationCssWriter;
  readonly indexedDb: IndexedDbClient;
  readonly videoFiles: VideoFilesModule;
  readonly preview: PreviewModule;
  readonly personSegmentationCacheRepository: PersonSegmentationCacheRepository;
  readonly telemetry: TelemetryModule;
  readonly appNoticeChannel: AppNoticeChannel;
  readonly errorClassifier: AppErrorClassifier;
  readonly errorTelemetryDescriber: AppErrorTelemetryDescriber;
  readonly storageFootprintProbe: StorageFootprintProbe;
  readonly fileDownloader: FileDownloader;
}

export type ProjectsModule = ReturnType<typeof bootProjects>;

/**
 * Boots the projects feature against an IndexedDB repository and
 * wires every project use case on top of it.
 */
export function bootProjects(deps: ProjectsDependencies) {
  const templateSubstitutionNotifier = new TemplateSubstitutionNotifier();
  const behindActorTemplateSubstituter = new BehindActorTemplateSubstituter(
    deps.behindActorSupportChecker,
    deps.behindActorFallbackTemplates,
    templateSubstitutionNotifier,
  );
  const templateReferenceResolver = new FallbackingTemplateReferenceResolver(
    deps.templateRepository,
    templateSubstitutionNotifier,
  );
  const serializer = new ProjectSerializer(
    templateReferenceResolver,
    new ProjectMigrator(
      deps.styledElementCatalog,
      deps.controlCssWriter,
      new HorizontalPlacementResolver(new HorizontalSideResolver()),
      deps.animationCssWriter,
    ),
    new StrongCharacterMajorityTextDirectionDetector(new BidiJsCharacterClassifier()),
    new DocumentElementIdCollector(),
    new TypographyConfigSerializer(),
    new StoredFontStackReader(new FontStackLibrary()),
  );

  const projectBuilder = new ProjectFromEditorStateBuilder();
  const editorStatePolicy = new EditorStateUnsavedWorkPolicy(deps.store);

  const repository: ProjectRepository = new IndexedDbProjectRepository(deps.indexedDb, serializer, deps.videoFiles.blobCache);
  const unsavedWorkPolicy: UnsavedWorkPolicy = editorStatePolicy;

  const thumbnails = new ThumbnailGenerator();
  const projectName = new ProjectName();
  const saveFailureReporter = new NonBlockingFailureReporter(
    deps.telemetry.telemetry,
    deps.appNoticeChannel,
    deps.errorClassifier,
    deps.errorTelemetryDescriber,
    deps.storageFootprintProbe,
    'project_save_failed',
  );
  const videoStoreFailureReporter = new NonBlockingFailureReporter(
    deps.telemetry.telemetry,
    deps.appNoticeChannel,
    deps.errorClassifier,
    deps.errorTelemetryDescriber,
    deps.storageFootprintProbe,
    'project_video_store_failed',
  );
  const projectOpenTelemetryReporter = new ProjectOpenTelemetryReporter(
    deps.store,
    deps.telemetry.telemetry,
    deps.errorClassifier,
    deps.errorTelemetryDescriber,
  );
  const originalVideoDownloadStore = new OriginalVideoDownloadStore();
  const startOriginalVideoDownload = new StartOriginalVideoDownloadAction(
    deps.store,
    originalVideoDownloadStore,
    repository,
  );
  return {
    repository,
    serializer,
    thumbnails,
    projectName,
    saveFailureReporter,
    videoStoreFailureReporter,
    originalVideoDownloadStore,
    unsavedWorkPolicy,
    actions: {
      create: new CreateProjectAction(deps.store, repository, thumbnails, projectName),
      save: new SaveProjectAction(deps.store, repository, projectBuilder, serializer),
      load: new LoadProjectAction(
        deps.store,
        deps.exportStore,
        originalVideoDownloadStore,
        deps.preview.proxyDownloadStore,
        repository,
        deps.refresh,
        deps.templateSupportChecker,
        templateSubstitutionNotifier,
        deps.preview.proxyResolver,
        startOriginalVideoDownload,
        deps.videoFiles.compatibilityChecker,
        behindActorTemplateSubstituter,
        projectName,
        projectOpenTelemetryReporter,
      ),
      delete: new DeleteProjectAction(repository),
      list: new ListProjectsAction(repository),
      export: new ExportProjectAction(repository, serializer, deps.fileDownloader),
      import: new ImportProjectAction(repository, serializer),
      recoverVideo: new RecoverProjectVideoAction(
        deps.store,
        repository,
        deps.preview.proxyResolver,
        deps.preview.proxyRepository,
        deps.personSegmentationCacheRepository,
        deps.videoFiles.compatibilityChecker,
        new MediaBunnyVideoMetadataProbe(),
        videoStoreFailureReporter,
      ),
      rename: new RenameProjectAction(deps.store, projectName),
      startOriginalVideoDownload,
    },
  };
}

/**
 * Returns the projects-store schema for the shared IndexedDB
 * connection. Called by the composition root before `bootUtils` so
 * the shared client knows about every store at open time. Row-shape
 * changes are handled lazily by the repository on read rather than
 * during the upgrade transaction.
 */
export function buildProjectsIndexedDbStoreDefinition(): IndexedDbStoreDefinition {
  return {
    name: 'projects',
    keyPath: 'id',
  };
}
