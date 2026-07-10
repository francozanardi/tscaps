import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { IndexedDbStoreDefinition } from '@core/_shared/infrastructure/IndexedDbStoreDefinition';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ExportStore } from '@core/export/store/ExportStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { TemplateBrowserSupportChecker } from '@core/browser-support/services/TemplateBrowserSupportChecker';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { UnsavedWorkPolicy } from '@core/projects/domain/UnsavedWorkPolicy';
import { IndexedDbProjectRepository } from '@core/projects/infrastructure/repositories/IndexedDbProjectRepository';
import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';
import { TemplateSubstitutionNotifier } from '@core/templates/domain/TemplateSubstitutionNotifier';
import { FallbackingTemplateReferenceResolver } from '@core/templates/services/FallbackingTemplateReferenceResolver';
import { ProjectSerializer } from '@core/projects/services/ProjectSerializer';
import { ProjectMigrator } from '@core/projects/services/migrations/ProjectMigrator';
import { ThumbnailGenerator } from '@core/projects/services/ThumbnailGenerator';
import { ProjectFromEditorStateBuilder } from '@core/projects/services/ProjectFromEditorStateBuilder';
import { EditorStateUnsavedWorkPolicy } from '@core/projects/services/EditorStateUnsavedWorkPolicy';
import { CreateProjectAction } from '@core/projects/actions/CreateProjectAction';
import { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
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
import type { VideoBlobCache } from '@core/videos/domain/VideoBlobCache';
import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import type { PreviewModule } from '@bootstrap/wiring/preview';
import type { VideosModule } from '@bootstrap/wiring/videos';

export interface ProjectsDependencies {
  readonly templateRepository: TemplateRepository;
  readonly store: EditorStore;
  readonly exportStore: ExportStore;
  readonly refresh: RefreshDocumentAction;
  readonly templateSupportChecker: TemplateBrowserSupportChecker;
  readonly indexedDb: IndexedDbClient;
  readonly videoBlobCache: VideoBlobCache;
  readonly videos: VideosModule;
  readonly preview: PreviewModule;
  readonly personSegmentationCacheRepository: PersonSegmentationCacheRepository;
}

export type ProjectsModule = ReturnType<typeof bootProjects>;

/**
 * Boots the projects feature against an IndexedDB repository and
 * wires every project use case on top of it.
 */
export function bootProjects(deps: ProjectsDependencies) {
  const templateSubstitutionNotifier = new TemplateSubstitutionNotifier();
  const templateReferenceResolver = new FallbackingTemplateReferenceResolver(
    deps.templateRepository,
    templateSubstitutionNotifier,
  );
  const serializer = new ProjectSerializer(templateReferenceResolver, new ProjectMigrator());

  const projectBuilder = new ProjectFromEditorStateBuilder();
  const editorStatePolicy = new EditorStateUnsavedWorkPolicy(deps.store);

  const repository: ProjectRepository = new IndexedDbProjectRepository(deps.indexedDb, serializer, deps.videoBlobCache);
  const unsavedWorkPolicy: UnsavedWorkPolicy = editorStatePolicy;

  const thumbnails = new ThumbnailGenerator();
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
    originalVideoDownloadStore,
    unsavedWorkPolicy,
    actions: {
      create: new CreateProjectAction(deps.store, repository, thumbnails),
      save: new SaveProjectAction(deps.store, repository, projectBuilder, serializer),
      load: new LoadProjectAction(
        deps.store,
        deps.exportStore,
        originalVideoDownloadStore,
        repository,
        deps.refresh,
        deps.templateSupportChecker,
        templateSubstitutionNotifier,
        deps.preview.proxyResolver,
        deps.preview.proxyRepository,
        startOriginalVideoDownload,
        deps.videos.services.compatibilityChecker,
      ),
      delete: new DeleteProjectAction(repository),
      list: new ListProjectsAction(repository),
      export: new ExportProjectAction(repository, serializer),
      import: new ImportProjectAction(repository, serializer),
      recoverVideo: new RecoverProjectVideoAction(
        deps.store,
        repository,
        deps.preview.proxyResolver,
        deps.preview.proxyRepository,
        deps.personSegmentationCacheRepository,
        deps.videos.services.compatibilityChecker,
        new MediaBunnyVideoMetadataProbe(),
      ),
      rename: new RenameProjectAction(deps.store),
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
