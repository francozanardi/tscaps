import type { IndexedDbClient } from '@core/_shared/persistence/IndexedDbClient';
import type { IndexedDbStoreDefinition } from '@core/_shared/persistence/IndexedDbStoreDefinition';
import type { VideoBlobCache } from '@core/videos/domain/VideoBlobCache';
import { IndexedDbVideoBlobCache } from '@core/videos/infrastructure/IndexedDbVideoBlobCache';

export interface VideosDependencies {
  readonly indexedDb: IndexedDbClient;
}

export interface VideosModule {
  readonly blobCache: VideoBlobCache;
}

/**
 * Boots the cross-cutting video-blob cache. Project repositories share
 * it so a recently opened video re-mounts instantly without prompting
 * a re-select or re-downloading from the remote source.
 */
export function bootVideos(deps: VideosDependencies): VideosModule {
  return {
    blobCache: new IndexedDbVideoBlobCache(deps.indexedDb),
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
