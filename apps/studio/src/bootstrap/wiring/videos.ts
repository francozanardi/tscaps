import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { IndexedDbStoreDefinition } from '@core/_shared/infrastructure/IndexedDbStoreDefinition';
import type { BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { VideoBlobCache } from '@core/videos/domain/VideoBlobCache';
import type { VideoCompatibilityChecker } from '@core/videos/domain/VideoCompatibilityChecker';
import { IndexedDbVideoBlobCache } from '@core/videos/infrastructure/IndexedDbVideoBlobCache';
import { MemoryFirstVideoBlobCache } from '@core/videos/infrastructure/MemoryFirstVideoBlobCache';
import { MediaBunnyVideoCompatibilityChecker } from '@core/videos/infrastructure/MediaBunnyVideoCompatibilityChecker';
import { MediaBunnyVideoMetadataProbe } from '@core/videos/infrastructure/MediaBunnyVideoMetadataProbe';
import { ClearVideoAction } from '@core/videos/actions/ClearVideoAction';
import { LoadVideoAction } from '@core/videos/actions/LoadVideoAction';
import { OriginalVideoKeeper } from '@core/videos/services/OriginalVideoKeeper';
import { OriginalVideoResolver } from '@core/videos/services/OriginalVideoResolver';
import { ReplaceOriginalVideoAction } from '@core/videos/actions/ReplaceOriginalVideoAction';
import type { ExportStore } from '@core/export/store/ExportStore';
import type { ProjectsModule } from '@bootstrap/wiring/projects';

/**
 * How many projects keep their source video resident in IndexedDB
 * before the least recently opened one is evicted.
 *
 * The preview-proxy cache reads this same number, and has to: the
 * editor's fast path opens a project against its cached proxy and
 * fetches the source in the background, so a proxy that outlives its
 * source opens a project that cannot be exported. Whoever changes
 * this changes both.
 */
export const MAX_CACHED_PROJECT_VIDEOS = 3;

export interface VideoFilesDependencies {
  readonly indexedDb: IndexedDbClient;
  readonly blobReadabilityProbe: BlobReadabilityProbe;
}

export interface VideoFilesModule {
  readonly blobCache: VideoBlobCache;
  readonly compatibilityChecker: VideoCompatibilityChecker;
}

export interface VideosDependencies {
  readonly store: EditorStore;
  readonly exportStore: ExportStore;
  readonly blobReadabilityProbe: BlobReadabilityProbe;
  readonly videoFiles: VideoFilesModule;
  readonly projects: ProjectsModule;
}

export interface VideosModule {
  readonly blobCache: VideoBlobCache;
  readonly keeper: OriginalVideoKeeper;
  readonly resolver: OriginalVideoResolver;
  readonly services: {
    readonly compatibilityChecker: VideoCompatibilityChecker;
  };
  readonly actions: {
    readonly load: LoadVideoAction;
    readonly clear: ClearVideoAction;
    readonly replaceOriginal: ReplaceOriginalVideoAction;
  };
}

/**
 * Boots the two collaborators every module that handles a video file
 * needs: where its bytes are cached, and whether this browser can
 * decode one.
 *
 * Kept apart from the rest of the module because they are needed
 * before it can exist — `bootProjects` takes both, and the rest of
 * `bootVideos` takes the project repository.
 */
export function bootVideoFiles(deps: VideoFilesDependencies): VideoFilesModule {
  return {
    blobCache: new MemoryFirstVideoBlobCache(
      new IndexedDbVideoBlobCache(deps.indexedDb, deps.blobReadabilityProbe, MAX_CACHED_PROJECT_VIDEOS),
      deps.blobReadabilityProbe,
    ),
    compatibilityChecker: new MediaBunnyVideoCompatibilityChecker(),
  };
}

/**
 * Boots what the editor does with its source video: taking a fresh
 * one, dropping it, keeping a durable copy, finding readable bytes
 * when the one in hand stops reading, and the re-pick that follows
 * when no copy anywhere can answer.
 *
 * Runs after `bootProjects` because half of that needs the project
 * repository and the download store, which is also what puts the
 * session stores `LoadVideoAction` clears within reach.
 */
export function bootVideos(deps: VideosDependencies): VideosModule {
  const keeper = new OriginalVideoKeeper(deps.store, deps.videoFiles.blobCache, deps.projects.repository);
  return {
    blobCache: deps.videoFiles.blobCache,
    keeper,
    resolver: new OriginalVideoResolver(
      deps.store,
      deps.blobReadabilityProbe,
      keeper,
      deps.projects.originalVideoDownloadStore,
    ),
    services: {
      compatibilityChecker: deps.videoFiles.compatibilityChecker,
    },
    actions: {
      load: new LoadVideoAction(
        deps.store,
        deps.exportStore,
        deps.projects.originalVideoDownloadStore,
        new MediaBunnyVideoMetadataProbe(),
      ),
      clear: new ClearVideoAction(deps.store),
      replaceOriginal: new ReplaceOriginalVideoAction(deps.store, keeper, deps.projects.videoStoreFailureReporter),
    },
  };
}

/**
 * Returns the schemas of the videos stores on the shared IndexedDB
 * connection: the bytes, and the access times the eviction order is
 * kept in, apart from the bytes so recording a read never rewrites a
 * video. Neither has per-version migrations — an entry with no
 * access record is simply treated as the least recently read.
 */
export function buildVideosIndexedDbStoreDefinitions(): IndexedDbStoreDefinition[] {
  return [
    { name: 'videos', keyPath: 'projectId' },
    { name: 'videos-access', keyPath: 'projectId' },
  ];
}
