import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { IndexedDbStoreDefinition } from '@core/_shared/infrastructure/IndexedDbStoreDefinition';
import type { VideoBlobCache } from '@core/videos/domain/VideoBlobCache';
import type { VideoCompatibilityChecker } from '@core/videos/domain/VideoCompatibilityChecker';
import { IndexedDbVideoBlobCache } from '@core/videos/infrastructure/IndexedDbVideoBlobCache';
import { MediaBunnyVideoCompatibilityChecker } from '@core/videos/infrastructure/MediaBunnyVideoCompatibilityChecker';

export interface VideosDependencies {
  readonly indexedDb: IndexedDbClient;
}

export interface VideosModule {
  readonly blobCache: VideoBlobCache;
  readonly services: {
    readonly compatibilityChecker: VideoCompatibilityChecker;
  };
}

/**
 * Boots cross-cutting video helpers shared across feature modules:
 * the per-project video blob cache (so a recently opened video
 * re-mounts instantly) and the browser-capability checker that
 * validates a source can flow through the pipeline before any
 * heavy work begins.
 */
export function bootVideos(deps: VideosDependencies): VideosModule {
  return {
    blobCache: new IndexedDbVideoBlobCache(deps.indexedDb),
    services: {
      compatibilityChecker: new MediaBunnyVideoCompatibilityChecker(),
    },
  };
}

/**
 * Returns the videos store schema for the shared IndexedDB
 * connection. The store has no per-version migrations today — the
 * `VideoRecord` shape has been stable since its introduction.
 */
export function buildVideosIndexedDbStoreDefinition(): IndexedDbStoreDefinition {
  return { name: 'videos', keyPath: 'projectId' };
}
