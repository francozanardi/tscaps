/**
 * Bounded local cache for the video bytes a project was created
 * from, so a recently opened project re-mounts instantly without
 * having to re-source the bytes.
 *
 * Implementations cap the number of cached entries — old blobs are
 * dropped LRU-style when `store` would push the cache over the cap.
 * Eviction never touches the entry being stored, so refreshing an
 * existing blob is always a no-op size-wise.
 *
 * `store` is the only mutator that can evict; `load` only updates
 * the recency stamp so the just-loaded entry survives the next
 * `store` call.
 */
export interface VideoBlobCache {
  load(projectId: string): Promise<Blob | null>;
  store(projectId: string, blob: Blob): Promise<void>;
  delete(projectId: string): Promise<void>;
}
