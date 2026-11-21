/**
 * Where one asset's trip to the user's remote copy stands.
 *
 * - `waiting`: queued, behind other files or behind the project that
 *   owns it reaching the server.
 * - `uploading`: its bytes are going up.
 * - `uploaded`: the remote copy holds it.
 * - `refused`: the remote copy will not take it — its type, its size,
 *   the plan's caps. Trying again changes nothing.
 * - `failed`: it did not go up, and trying again may.
 */
export type MediaAssetUploadPhase = 'waiting' | 'uploading' | 'uploaded' | 'refused' | 'failed';

/**
 * Why the remote copy refused a file, for `refused`:
 *
 * - `file`: its type or size is not one it takes.
 * - `count`: the user already keeps as many files as they may.
 * - `storage`: the file does not fit in the space the user has left.
 * - `owner-gone`: the project it belongs to no longer exists.
 */
export type MediaAssetUploadRefusal = 'file' | 'count' | 'storage' | 'owner-gone';

export interface MediaAssetUploadStatus {
  readonly phase: MediaAssetUploadPhase;
  /** The fraction that has gone up, while uploading; null otherwise. */
  readonly progress: number | null;
  /** Why it did not go up, for `refused` and `failed`. */
  readonly error: unknown;
  /** What the refusal was about, for `refused`; null otherwise. */
  readonly refusal?: MediaAssetUploadRefusal | null;
}
